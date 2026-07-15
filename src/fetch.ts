import { getHeader, isAnthropicMessagesURL, sessionIDFromHeaders } from "./headers"
import {
  isSourceCompatibleProfile,
  SOURCE_COMPATIBLE_CLI_VERSION,
  SOURCE_COMPATIBLE_SDK_VERSION,
} from "./profile/claude-code-profile"
import { buildClaudeCodeHeaders } from "./profile/headers"
import { createRuntimeParityContext } from "./runtime/context"
import { createRuntimeParityState } from "./runtime/state"
import { transformRequestBody } from "./transform/request"
import { transformResponse } from "./transform/response"
import type { ResolvedBridgeOptions } from "./types"

const CLAUDE_CODE_ANTHROPIC_BETA =
  "claude-code-20250219,interleaved-thinking-2025-05-14,thinking-token-count-2026-05-13,context-management-2025-06-27,prompt-caching-scope-2026-01-05,mid-conversation-system-2026-04-07,effort-2025-11-24"

interface BridgeFetchInput {
  options: ResolvedBridgeOptions
  upstreamFetch?: typeof fetch
}

function requestURL(input: RequestInfo | URL): string {
  if (input instanceof Request) return input.url
  return String(input)
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  return String(init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
}

function requestHeaders(input: RequestInfo | URL, init?: RequestInit): HeadersInit | undefined {
  return init?.headers ?? (input instanceof Request ? input.headers : undefined)
}

async function bodyInitText(body: BodyInit): Promise<string | undefined> {
  if (typeof body === "string") return body
  if (body instanceof URLSearchParams) return body.toString()
  if (typeof Blob !== "undefined" && body instanceof Blob) return body.text()
  if (body instanceof ArrayBuffer) return new TextDecoder().decode(body)
  if (ArrayBuffer.isView(body)) return new TextDecoder().decode(body)
  return undefined
}

async function requestBodyText(input: RequestInfo | URL, init?: RequestInit): Promise<string | undefined> {
  if (init?.body != null) return bodyInitText(init.body)
  if (input instanceof Request) return input.clone().text()
  return undefined
}

function isJSONContentType(headers: HeadersInit | undefined): boolean {
  return getHeader(headers, "content-type")?.toLowerCase().includes("application/json") ?? false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function textFromSystem(system: unknown): string {
  if (typeof system === "string") return system
  if (!Array.isArray(system)) return ""

  return system
    .map((block) => (isRecord(block) && typeof block.text === "string" ? block.text : ""))
    .filter(Boolean)
    .join("\n")
}

function isTitleGenerationRequest(body: unknown): boolean {
  return (
    isRecord(body) &&
    body.stream === true &&
    !("tools" in body) &&
    textFromSystem(body.system).includes("You are a title generator")
  )
}

function localTitleResponse(model = "claude-haiku-4-5-20251001"): Response {
  const messageStart = JSON.stringify({
    type: "message_start",
    message: {
      id: "msg_title_local",
      type: "message",
      role: "assistant",
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  })
  const body = [
    `event: message_start\ndata: ${messageStart}`,
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"New chat"}}',
    'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}',
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":2}}',
    'event: message_stop\ndata: {"type":"message_stop"}',
    "",
  ].join("\n\n")

  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  })
}

function normalizeAnthropicHeaders(headers: HeadersInit | undefined, options: ResolvedBridgeOptions): Headers {
  const original = new Headers(headers)
  const next = new Headers()

  next.set("accept", "application/json")
  if (original.get("content-type")) next.set("content-type", "application/json")

  const apiKey = original.get("x-api-key")
  if (apiKey) next.set("x-api-key", apiKey)

  const authorization = original.get("authorization")
  if (authorization) next.set("authorization", authorization)

  next.set("anthropic-version", "2023-06-01")
  next.set("anthropic-beta", CLAUDE_CODE_ANTHROPIC_BETA)
  next.set("anthropic-dangerous-direct-browser-access", "true")
  next.set("x-app", "cli")
  next.set("user-agent", "claude-cli/2.1.205 (external, sdk-cli)")

  const sessionID = options.sessionId ?? sessionIDFromHeaders(headers)
  if (sessionID) next.set("x-claude-code-session-id", sessionID)

  return next
}

export function createBridgeFetch(input: BridgeFetchInput): typeof fetch {
  const upstreamFetch = input.upstreamFetch ?? globalThis.fetch
  const runtimeState = createRuntimeParityState()

  return async function bridgeFetch(requestInput: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = requestURL(requestInput)
    const method = requestMethod(requestInput, init)
    const headers = requestHeaders(requestInput, init)

    if (!input.options.enabled || method !== "POST" || !isAnthropicMessagesURL(url)) {
      return upstreamFetch(requestInput, init)
    }

    if (!isJSONContentType(headers)) {
      return upstreamFetch(requestInput, init)
    }

    const rawBody = await requestBodyText(requestInput, init)
    if (!rawBody) {
      return upstreamFetch(requestInput, init)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawBody)
    } catch {
      return upstreamFetch(requestInput, init)
    }

    if (isTitleGenerationRequest(parsed)) {
      const model = isRecord(parsed) && typeof parsed.model === "string" ? parsed.model : undefined
      return localTitleResponse(model)
    }

    const sessionID = sessionIDFromHeaders(headers)
    const runtimeContext = await createRuntimeParityContext(parsed, {
      options: input.options,
      sessionID,
      state: runtimeState,
    })

    const transformed = transformRequestBody(parsed, {
      requestURL: url,
      sessionID,
      options: input.options,
      runtimeContext,
    })
    const nextHeaders = isSourceCompatibleProfile(input.options)
      ? buildClaudeCodeHeaders({
          originalHeaders: headers,
          cliVersion: SOURCE_COMPATIBLE_CLI_VERSION,
          sdkVersion: SOURCE_COMPATIBLE_SDK_VERSION,
          sessionId: input.options.sessionId ?? sessionID,
          stream: transformed.stream === true,
          body: transformed,
        })
      : normalizeAnthropicHeaders(headers, input.options)

    const response = await upstreamFetch(requestInput, {
      ...init,
      headers: nextHeaders,
      body: JSON.stringify(transformed),
    })

    return transformResponse(response)
  }
}
