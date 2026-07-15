import { redactJson, redactString } from "./redact"
import type { JsonObject, ParityRequestSnapshot, RedactionMap } from "./types"

function normalizeHeaders(headers: Record<string, string>, redactions: RedactionMap): Record<string, string> {
  const normalized = Object.entries(headers).map(([key, value]) => {
    const lower = key.toLowerCase()
    if (lower === "x-api-key") return [lower, "$API_KEY_REDACTED"] as const
    if (lower === "authorization") return [lower, "$AUTHORIZATION_REDACTED"] as const
    if (lower === "x-claude-code-session-id") return [lower, "$SESSION_ID"] as const
    return [lower, redactString(value, redactions)] as const
  })
  return Object.fromEntries(normalized.sort(([left], [right]) => left.localeCompare(right)))
}

function normalizeMetadata(body: JsonObject, redactions: RedactionMap): JsonObject {
  const metadata = body.metadata
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return body

  const userId = metadata.user_id
  if (typeof userId !== "string") return body

  try {
    const parsed = JSON.parse(userId) as JsonObject
    const redacted = redactJson(parsed, redactions)
    return { ...body, metadata: { ...metadata, user_id: JSON.stringify(redacted) } }
  } catch {
    return body
  }
}

export function normalizeSnapshot(snapshot: ParityRequestSnapshot, redactions: RedactionMap = {}): ParityRequestSnapshot {
  const body = normalizeMetadata(redactJson(snapshot.body, redactions) as JsonObject, redactions)
  return {
    method: snapshot.method,
    urlKind: snapshot.urlKind,
    headers: normalizeHeaders(snapshot.headers, redactions),
    body,
  }
}
