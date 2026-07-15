import type { BridgeOptions, ResolvedBridgeOptions } from "./types"
import type { ResolvedRuntimeParityOptions, RuntimeParityOptions } from "./runtime/types"

const defaultRuntimeParity: ResolvedRuntimeParityOptions = {
  enabled: false,
  profile: "2.1.205-capture",
  diagnostics: false,
  strictSystem: false,
  stableFakeMetadata: false,
  cwd: undefined,
  scanClaudeMd: false,
  preReadFiles: false,
  mirrorMcpTools: false,
  simulateHooks: false,
  simulatePermissions: false,
  cache: false,
  maxMemoryBytes: 4194304,
  memoryStartDir: undefined,
  activePaths: [],
  readWorkspaceFiles: false,
  executeMcpServers: false,
  executeHooks: false,
  allowShellCommands: false,
  commandAllowlist: [],
  envAllowlist: [],
  executionTimeoutMs: 5000,
  maxCommandOutputBytes: 65536,
  permissionPolicy: undefined,
  permissionDecisions: {},
  metadataSource: "stable-fake",
  preReadMessages: [],
  hookSystemMessages: [],
  permissionSystemMessages: [],
  mcpTools: [],
}

function resolveRuntimeParity(input: boolean | RuntimeParityOptions | undefined): ResolvedRuntimeParityOptions {
  if (input === false) return { ...defaultRuntimeParity, enabled: false }
  if (input === undefined) return { ...defaultRuntimeParity }
  if (input === true) return { ...defaultRuntimeParity, enabled: true, mirrorMcpTools: true }

  const hasCwd = typeof input.cwd === "string" && input.cwd.length > 0
  const highPermissionEnabled = hasCwd
  return {
    ...defaultRuntimeParity,
    ...input,
    enabled: input.enabled ?? true,
    scanClaudeMd: hasCwd && input.scanClaudeMd === true,
    preReadFiles: input.preReadFiles === true,
    mirrorMcpTools: input.mirrorMcpTools ?? true,
    readWorkspaceFiles: highPermissionEnabled && input.readWorkspaceFiles === true,
    executeMcpServers: input.executeMcpServers === true,
    executeHooks: highPermissionEnabled && input.executeHooks === true,
    allowShellCommands: highPermissionEnabled && input.allowShellCommands === true,
    commandAllowlist: [...(input.commandAllowlist ?? [])],
    envAllowlist: [...(input.envAllowlist ?? [])],
    memoryStartDir: typeof input.memoryStartDir === "string" && input.memoryStartDir.length > 0 ? input.memoryStartDir : undefined,
    activePaths: [...(input.activePaths ?? [])],
    executionTimeoutMs: input.executionTimeoutMs ?? defaultRuntimeParity.executionTimeoutMs,
    maxCommandOutputBytes: input.maxCommandOutputBytes ?? defaultRuntimeParity.maxCommandOutputBytes,
    permissionDecisions: { ...(input.permissionDecisions ?? {}) },
    preReadMessages: [...(input.preReadMessages ?? [])],
    hookSystemMessages: [...(input.hookSystemMessages ?? [])],
    permissionSystemMessages: [...(input.permissionSystemMessages ?? [])],
    mcpTools: structuredClone(input.mcpTools ?? []),
  }
}

const defaultOptions: Omit<ResolvedBridgeOptions, "runtimeParity"> = {
  enabled: true,
  mode: "fetch",
  maxTokens: 64000,
  effortMap: { max: "xhigh" },
  effort: "high",
  includeBillingHeader: true,
  rewriteSystemIdentity: true,
  removeEagerInputStreaming: true,
  debug: false,
}

export function resolveBridgeOptions(input: BridgeOptions | undefined): ResolvedBridgeOptions {
  return {
    ...defaultOptions,
    ...(input ?? {}),
    effortMap: {
      ...defaultOptions.effortMap,
      ...(input?.effortMap ?? {}),
    },
    runtimeParity: resolveRuntimeParity(input?.runtimeParity),
  }
}
