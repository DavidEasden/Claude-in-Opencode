import type { RuntimeStateEvidence, UnsupportedRuntimeGap } from "./domain"

export type RuntimeParityProfile = "2.1.205-capture" | "source-compatible"
export type RuntimePermissionDecision = "allow" | "deny"
export type RuntimePermissionPolicy = RuntimePermissionDecision | "prompt"
export type RuntimeMetadataSource = "explicit" | "stable-fake" | "captured-replay"

export interface RuntimeParityOptions {
  enabled?: boolean
  profile?: RuntimeParityProfile
  diagnostics?: boolean
  strictSystem?: boolean
  stableFakeMetadata?: boolean
  cwd?: string
  scanClaudeMd?: boolean
  preReadFiles?: boolean
  mirrorMcpTools?: boolean
  simulateHooks?: boolean
  simulatePermissions?: boolean
  cache?: boolean
  maxMemoryBytes?: number
  memoryStartDir?: string
  activePaths?: string[]
  readWorkspaceFiles?: boolean
  executeMcpServers?: boolean
  executeHooks?: boolean
  allowShellCommands?: boolean
  commandAllowlist?: string[]
  envAllowlist?: string[]
  executionTimeoutMs?: number
  maxCommandOutputBytes?: number
  permissionPolicy?: RuntimePermissionPolicy
  permissionDecisions?: Record<string, RuntimePermissionDecision>
  metadataSource?: RuntimeMetadataSource
  preReadMessages?: string[]
  hookSystemMessages?: string[]
  permissionSystemMessages?: string[]
  mcpTools?: Array<Record<string, unknown>>
}

export interface ResolvedRuntimeParityOptions {
  enabled: boolean
  profile: RuntimeParityProfile
  diagnostics: boolean
  strictSystem: boolean
  stableFakeMetadata: boolean
  cwd?: string
  scanClaudeMd: boolean
  preReadFiles: boolean
  mirrorMcpTools: boolean
  simulateHooks: boolean
  simulatePermissions: boolean
  cache: boolean
  maxMemoryBytes: number
  memoryStartDir?: string
  activePaths: string[]
  readWorkspaceFiles: boolean
  executeMcpServers: boolean
  executeHooks: boolean
  allowShellCommands: boolean
  commandAllowlist: string[]
  envAllowlist: string[]
  executionTimeoutMs: number
  maxCommandOutputBytes: number
  permissionPolicy?: RuntimePermissionPolicy
  permissionDecisions: Record<string, RuntimePermissionDecision>
  metadataSource: RuntimeMetadataSource
  preReadMessages: string[]
  hookSystemMessages: string[]
  permissionSystemMessages: string[]
  mcpTools: Array<Record<string, unknown>>
}

export interface RuntimeParityContext {
  claudeMd?: string
  insertedMessages: Array<{ role: "system"; content: string }>
  mirroredMcpTools: Array<Record<string, unknown>>
  gaps: UnsupportedRuntimeGap[]
  stateUsed: RuntimeStateEvidence[]
}

export interface RuntimeParityGateResult {
  equivalent: boolean
  diffCount: number
  gapCount: number
  reasons: string[]
}

export interface RuntimeParityState {
  memoryByCwd: Map<string, { text: string; loadedAt: number }>
}
