import type { ResolvedRuntimeParityOptions, RuntimeParityContext, RuntimeParityOptions } from "./runtime/types"

export type JsonObject = Record<string, unknown>

export type BridgeMode = "fetch"

export interface BridgeOptions {
  enabled?: boolean
  mode?: BridgeMode
  // 兼容旧配置：strict 2.1.205 profile 固定 request shape，不读取这些字段。
  maxTokens?: number
  effortMap?: Record<string, string>
  sessionId?: string
  deviceId?: string
  accountUuid?: string
  effort?: string
  toolNames?: string[]
  systemPrompt?: string
  appendSystemPrompt?: string
  userContextBlock?: string
  currentDate?: string
  runtimeParity?: boolean | RuntimeParityOptions
  // 兼容旧配置：strict 2.1.205 profile 固定 system/header/tool 形态，不读取这些字段。
  includeBillingHeader?: boolean
  rewriteSystemIdentity?: boolean
  removeEagerInputStreaming?: boolean
  debug?: boolean
}

export interface ResolvedBridgeOptions {
  enabled: boolean
  mode: BridgeMode
  // 兼容旧配置：strict 2.1.205 profile 固定 request shape，不读取这些字段。
  maxTokens: number
  effortMap: Record<string, string>
  sessionId?: string
  deviceId?: string
  accountUuid?: string
  effort: string
  toolNames?: string[]
  systemPrompt?: string
  appendSystemPrompt?: string
  userContextBlock?: string
  currentDate?: string
  runtimeParity: ResolvedRuntimeParityOptions
  // 兼容旧配置：strict 2.1.205 profile 固定 system/header/tool 形态，不读取这些字段。
  includeBillingHeader: boolean
  rewriteSystemIdentity: boolean
  removeEagerInputStreaming: boolean
  debug: boolean
}

export interface TransformContext {
  sessionID?: string
  requestURL: string
  options: ResolvedBridgeOptions
  runtimeContext?: RuntimeParityContext
}

export interface AnthropicTextBlock {
  type: "text"
  text: string
  cache_control?: { type: "ephemeral"; ttl?: "5m" | "1h" }
}

export interface AnthropicRequestBody extends JsonObject {
  model?: unknown
  max_tokens?: unknown
  thinking?: unknown
  output_config?: unknown
  context_management?: unknown
  metadata?: unknown
  system?: unknown
  messages?: unknown
  tools?: unknown
  stream?: unknown
}
