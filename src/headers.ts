type HeaderInput = HeadersInit | undefined

export function getHeader(headers: HeaderInput, name: string): string | undefined {
  if (!headers) return undefined
  const lower = name.toLowerCase()

  if (headers instanceof Headers) return headers.get(name) ?? undefined
  if (Array.isArray(headers)) {
    const item = headers.find(([key]) => key.toLowerCase() === lower)
    return item?.[1]
  }

  const item = Object.entries(headers).find(([key]) => key.toLowerCase() === lower)
  return item?.[1]
}

export function sessionIDFromHeaders(headers: HeaderInput): string | undefined {
  return (
    getHeader(headers, "x-session-id") ??
    getHeader(headers, "session_id") ??
    getHeader(headers, "conversation_id") ??
    undefined
  )
}

export function isAnthropicMessagesURL(input: string): boolean {
  try {
    const url = new URL(input)
    return url.pathname.endsWith("/v1/messages") || url.pathname.endsWith("/messages")
  } catch {
    return false
  }
}
