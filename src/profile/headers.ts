import { getHeader } from "../headers"

interface ClaudeCodeHeaderInput {
  originalHeaders?: HeadersInit
  cliVersion: string
  sdkVersion: string
  sessionId?: string
  stream?: boolean
  body?: Record<string, unknown>
}

function buildBetas(body?: Record<string, unknown>): string {
  const betas = ["claude-code-20250219", "interleaved-thinking-2025-05-14"]
  if (body?.context_management) betas.push("context-management-2025-06-27")
  const outputConfig = body?.output_config
  if (typeof outputConfig === "object" && outputConfig !== null && "effort" in outputConfig) {
    betas.push("effort-2025-11-24")
  }
  return betas.join(",")
}

export function buildClaudeCodeHeaders(input: ClaudeCodeHeaderInput): Headers {
  const next = new Headers()
  const contentType = getHeader(input.originalHeaders, "content-type")
  const apiKey = getHeader(input.originalHeaders, "x-api-key")
  const authorization = getHeader(input.originalHeaders, "authorization")

  next.set("accept", "application/json")
  if (contentType) next.set("content-type", "application/json")
  if (apiKey) next.set("x-api-key", apiKey)
  if (authorization) next.set("authorization", authorization)

  next.set("user-agent", `claude-cli/${input.cliVersion} (external, cli)`)
  next.set("x-app", "cli")
  next.set("anthropic-version", "2023-06-01")
  next.set("anthropic-beta", buildBetas(input.body))
  next.set("anthropic-dangerous-direct-browser-access", "true")
  next.set("x-stainless-lang", "js")
  next.set("x-stainless-package-version", input.sdkVersion)
  next.set("x-stainless-retry-count", "0")
  next.set("x-stainless-timeout", "600")

  if (input.sessionId) next.set("x-claude-code-session-id", input.sessionId)
  if (input.stream) next.set("x-stainless-helper-method", "stream")

  return next
}
