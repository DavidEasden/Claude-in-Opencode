import { describe, expect, it } from "vitest"
import { transformResponse } from "../src/transform/response"

async function text(response: Response): Promise<string> {
  return response.text()
}

describe("transformResponse", () => {
  it("passes through normal SSE responses", async () => {
    const response = new Response("event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n", {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    })

    const result = transformResponse(response)

    expect(result.status).toBe(200)
    expect(result.headers.get("content-type")).toContain("text/event-stream")
    expect(await result.text()).toContain("message_stop")
  })

  it("maps Claude Code SSE tool_use names back to opencode names", async () => {
    const input = new Response(
      [
        "event: content_block_start",
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_1","name":"Bash","input":{}}}',
        "",
        "event: content_block_delta",
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\\"command\\\":\\\"printf ok\\\"}"}}',
        "",
      ].join("\n"),
      { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } },
    )

    const output = await text(transformResponse(input))

    expect(output).toContain('"name":"bash"')
    expect(output).not.toContain('"name":"Bash"')
    expect(output).toContain('"partial_json":"{\\"command\\":\\"printf ok\\"}"')
  })

  it("streams rewritten tool_use before upstream closes", async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const upstream = new ReadableStream<Uint8Array>({
      start(current) {
        controller = current
      },
    })
    const response = transformResponse(
      new Response(upstream, {
        headers: {
          "content-type": "text/event-stream",
          "content-length": "999",
          "content-encoding": "gzip",
        },
      }),
    )
    const reader = response.body!.getReader()

    controller.enqueue(
      encoder.encode(
        [
          "event: content_block_start",
          'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_1","name":"Bash","input":{}}}',
          "",
        ].join("\n"),
      ),
    )

    let decoded = ""
    for (let attempt = 0; attempt < 4 && !decoded.includes('"name":"bash"'); attempt += 1) {
      const chunk = await reader.read()
      expect(chunk.done).toBe(false)
      decoded += decoder.decode(chunk.value)
    }

    expect(decoded).toContain('"name":"bash"')
    expect(response.headers.get("content-length")).toBeNull()
    expect(response.headers.get("content-encoding")).toBeNull()

    await reader.cancel()
  })

  it("leaves non-SSE responses unchanged", async () => {
    const input = new Response("plain", { status: 200, headers: { "content-type": "text/plain" } })

    const output = transformResponse(input)

    expect(await output.text()).toBe("plain")
  })
})
