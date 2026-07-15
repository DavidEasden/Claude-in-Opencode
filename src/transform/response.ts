import { opencodeToolName } from "./tool-names"

function isEventStream(response: Response): boolean {
  return response.headers.get("content-type")?.toLowerCase().includes("text/event-stream") ?? false
}

function rewriteDataLine(line: string): string {
  if (!line.startsWith("data: ")) return line

  try {
    const parsed = JSON.parse(line.slice(6))
    if (
      parsed?.type === "content_block_start" &&
      parsed.content_block?.type === "tool_use" &&
      typeof parsed.content_block.name === "string"
    ) {
      parsed.content_block.name = opencodeToolName(parsed.content_block.name)
      return `data: ${JSON.stringify(parsed)}`
    }
  } catch {
    return line
  }

  return line
}

function transformedHeaders(headers: Headers): Headers {
  const next = new Headers(headers)
  next.delete("content-length")
  next.delete("content-encoding")
  return next
}

function transformEventStreamBody(body: ReadableStream<Uint8Array> | null): BodyInit | null {
  if (!body) return null

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  let cancelled = false
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    start(controller) {
      reader = body.getReader()
      let buffer = ""

      const enqueueCompleteLines = () => {
        let lineEnd = buffer.indexOf("\n")
        while (lineEnd !== -1) {
          const line = buffer.slice(0, lineEnd)
          buffer = buffer.slice(lineEnd + 1)
          controller.enqueue(encoder.encode(`${rewriteDataLine(line)}\n`))
          lineEnd = buffer.indexOf("\n")
        }
      }

      void (async () => {
        try {
          while (!cancelled) {
            const { done, value } = await reader!.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            enqueueCompleteLines()
          }

          if (cancelled) return

          buffer += decoder.decode()
          enqueueCompleteLines()

          if (buffer.length > 0) {
            controller.enqueue(encoder.encode(rewriteDataLine(buffer)))
          }

          controller.close()
        } catch (error) {
          if (!cancelled) controller.error(error)
        } finally {
          reader?.releaseLock()
        }
      })()
    },
    cancel(reason) {
      cancelled = true
      return reader?.cancel(reason)
    },
  })
}

export function transformResponse(response: Response): Response {
  if (!isEventStream(response)) return response

  const body = transformEventStreamBody(response.body)

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: transformedHeaders(response.headers),
  })
}
