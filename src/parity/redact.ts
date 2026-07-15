import type { JsonValue, ParityRequestSnapshot, RedactionMap } from "./types"

const SECRET_PATTERNS = [
  { pattern: /sk-ant-[A-Za-z0-9_-]+/g, replacement: "$API_KEY_REDACTED" },
  { pattern: /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, replacement: "$AUTHORIZATION_REDACTED" },
]

const JSON_KEY_REDACTIONS: Record<string, string> = {
  account_uuid: "$ACCOUNT_UUID",
  device_id: "$DEVICE_ID",
  session_id: "$SESSION_ID",
}

function replaceAll(value: string, search: string | undefined, replacement: string): string {
  if (!search) return value
  return value.split(search).join(replacement)
}

export function redactString(value: string, redactions: RedactionMap = {}): string {
  let next = value
  next = replaceAll(next, redactions.projectRoot, "$PROJECT_ROOT")
  next = replaceAll(next, redactions.home, "$HOME")
  next = replaceAll(next, redactions.sessionId, "$SESSION_ID")
  next = replaceAll(next, redactions.deviceId, "$DEVICE_ID")
  next = replaceAll(next, redactions.accountUuid, "$ACCOUNT_UUID")

  for (const secret of SECRET_PATTERNS) next = next.replace(secret.pattern, secret.replacement)
  return next
}

export function redactJson(value: JsonValue, redactions: RedactionMap = {}): JsonValue {
  if (typeof value === "string") return redactString(value, redactions)
  if (Array.isArray(value)) return value.map((item) => redactJson(item, redactions))
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, JSON_KEY_REDACTIONS[key] ?? redactJson(entry, redactions)]))
  }
  return value
}

function redactHeaderValue(key: string, value: string, redactions: RedactionMap): string {
  const lower = key.toLowerCase()
  if (lower === "x-api-key") return "$API_KEY_REDACTED"
  if (lower === "authorization") return "$AUTHORIZATION_REDACTED"
  if (lower === "x-claude-code-session-id") return "$SESSION_ID"
  return redactString(value, redactions)
}

export function redactSnapshot(snapshot: ParityRequestSnapshot, redactions: RedactionMap = {}): ParityRequestSnapshot {
  return {
    method: snapshot.method,
    urlKind: snapshot.urlKind,
    headers: Object.fromEntries(Object.entries(snapshot.headers).map(([key, value]) => [key, redactHeaderValue(key, value, redactions)])),
    body: redactJson(snapshot.body, redactions) as ParityRequestSnapshot["body"],
  }
}
