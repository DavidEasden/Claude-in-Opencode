import { describe, expect, it } from "vitest"
import { resolveBridgeOptions } from "../src/config"

const defaultBridgeOptions = {
  enabled: true,
  mode: "fetch",
  maxTokens: 64000,
  effortMap: { max: "xhigh" },
  effort: "high",
  runtimeParity: {
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
  },
  includeBillingHeader: true,
  rewriteSystemIdentity: true,
  removeEagerInputStreaming: true,
  debug: false,
}

const configurableParityFields = [
  "sessionId",
  "deviceId",
  "accountUuid",
  "toolNames",
  "systemPrompt",
  "appendSystemPrompt",
  "userContextBlock",
  "currentDate",
] as const

describe("resolveBridgeOptions", () => {
  it("uses safe defaults", () => {
    expect(resolveBridgeOptions({})).toEqual(defaultBridgeOptions)
  })

  it("uses safe defaults for undefined input", () => {
    expect(resolveBridgeOptions(undefined)).toEqual(defaultBridgeOptions)
  })

  it("leaves dynamic parity fields undefined by default", () => {
    const options = resolveBridgeOptions({})

    for (const field of configurableParityFields) {
      expect(options[field]).toBeUndefined()
    }
  })

  it("preserves explicit parity fields", () => {
    expect(
      resolveBridgeOptions({
        sessionId: "session-123",
        deviceId: "device-123",
        accountUuid: "account-123",
        effort: "medium",
        toolNames: ["Read", "Write"],
        systemPrompt: "system prompt",
        appendSystemPrompt: "append prompt",
        userContextBlock: "context block",
        currentDate: "2026-07-11",
      }),
    ).toMatchObject({
      sessionId: "session-123",
      deviceId: "device-123",
      accountUuid: "account-123",
      effort: "medium",
      toolNames: ["Read", "Write"],
      systemPrompt: "system prompt",
      appendSystemPrompt: "append prompt",
      userContextBlock: "context block",
      currentDate: "2026-07-11",
    })
  })

  it("merges user options", () => {
    expect(resolveBridgeOptions({ maxTokens: 8192, debug: true })).toMatchObject({
      maxTokens: 8192,
      debug: true,
    })
  })

  it("keeps default effort map entries when adding user entries", () => {
    expect(resolveBridgeOptions({ effortMap: { low: "low" } }).effortMap).toEqual({
      max: "xhigh",
      low: "low",
    })
  })

  it("overrides default effort map entries", () => {
    expect(resolveBridgeOptions({ effortMap: { max: "medium" } }).effortMap).toEqual({
      max: "medium",
    })
  })

  it("keeps runtime parity disabled by default", () => {
    expect(resolveBridgeOptions({}).runtimeParity).toEqual({
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
    })
  })

  it("defaults max runtime parity controls safely", () => {
    expect(resolveBridgeOptions({}).runtimeParity).toMatchObject({
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
    })
  })

  it("enables MCP mirroring by default whenever runtime parity is enabled", () => {
    expect(resolveBridgeOptions({ runtimeParity: true }).runtimeParity).toMatchObject({
      enabled: true,
      mirrorMcpTools: true,
    })
    expect(resolveBridgeOptions({ runtimeParity: { enabled: true } }).runtimeParity).toMatchObject({
      enabled: true,
      mirrorMcpTools: true,
    })
  })

  it("preserves an explicit MCP mirror opt-out", () => {
    expect(
      resolveBridgeOptions({ runtimeParity: { enabled: true, mirrorMcpTools: false } }).runtimeParity.mirrorMcpTools,
    ).toBe(false)
  })

  it("preserves executeMcpServers without cwd for ownership diagnostics", () => {
    expect(
      resolveBridgeOptions({ runtimeParity: { enabled: true, executeMcpServers: true } }).runtimeParity,
    ).toMatchObject({
      enabled: true,
      executeMcpServers: true,
    })
  })

  it("keeps MCP mirroring disabled when runtime parity is omitted", () => {
    expect(resolveBridgeOptions({}).runtimeParity).toMatchObject({
      enabled: false,
      mirrorMcpTools: false,
    })
  })

  it("keeps cwd-backed high-permission controls disabled without cwd", () => {
    const runtime = resolveBridgeOptions({
      runtimeParity: {
        enabled: true,
        readWorkspaceFiles: true,
        executeMcpServers: true,
        executeHooks: true,
        allowShellCommands: true,
        commandAllowlist: ["node"],
        envAllowlist: ["PATH"],
      },
    }).runtimeParity

    expect(runtime.cwd).toBeUndefined()
    expect(runtime.readWorkspaceFiles).toBe(false)
    expect(runtime.executeMcpServers).toBe(true)
    expect(runtime.executeHooks).toBe(false)
    expect(runtime.allowShellCommands).toBe(false)
    expect(runtime.commandAllowlist).toEqual(["node"])
    expect(runtime.envAllowlist).toEqual(["PATH"])
  })

  it("resolves high-permission controls when cwd is explicit", () => {
    const runtime = resolveBridgeOptions({
      runtimeParity: {
        cwd: "/tmp/project",
        readWorkspaceFiles: true,
        executeMcpServers: true,
        executeHooks: true,
        allowShellCommands: true,
        commandAllowlist: ["node", "/usr/bin/env"],
        envAllowlist: ["PATH", "HOME"],
        executionTimeoutMs: 250,
        maxCommandOutputBytes: 4096,
        permissionPolicy: "deny",
        permissionDecisions: { "Bash(rm *)": "deny" },
        metadataSource: "captured-replay",
      },
    }).runtimeParity

    expect(runtime).toMatchObject({
      enabled: true,
      cwd: "/tmp/project",
      readWorkspaceFiles: true,
      executeMcpServers: true,
      executeHooks: true,
      allowShellCommands: true,
      commandAllowlist: ["node", "/usr/bin/env"],
      envAllowlist: ["PATH", "HOME"],
      executionTimeoutMs: 250,
      maxCommandOutputBytes: 4096,
      permissionPolicy: "deny",
      permissionDecisions: { "Bash(rm *)": "deny" },
      metadataSource: "captured-replay",
    })
  })

  it("resolves workspace memory start and active paths", () => {
    const runtime = resolveBridgeOptions({
      runtimeParity: {
        cwd: "/tmp/project",
        memoryStartDir: "/tmp/project/packages/app",
        activePaths: ["src/index.ts", "docs/guide.md"],
      },
    }).runtimeParity

    expect(runtime.memoryStartDir).toBe("/tmp/project/packages/app")
    expect(runtime.activePaths).toEqual(["src/index.ts", "docs/guide.md"])
  })

  it("defaults runtime parity profile options conservatively", () => {
    const options = resolveBridgeOptions({})

    expect(options.runtimeParity.profile).toBe("2.1.205-capture")
    expect(options.runtimeParity.diagnostics).toBe(false)
    expect(options.runtimeParity.strictSystem).toBe(false)
    expect(options.runtimeParity.stableFakeMetadata).toBe(false)
  })

  it("resolves opt-in source-compatible runtime parity options", () => {
    const options = resolveBridgeOptions({
      runtimeParity: {
        enabled: true,
        profile: "source-compatible",
        diagnostics: true,
        strictSystem: true,
        stableFakeMetadata: true,
      },
    })

    expect(options.runtimeParity.enabled).toBe(true)
    expect(options.runtimeParity.profile).toBe("source-compatible")
    expect(options.runtimeParity.diagnostics).toBe(true)
    expect(options.runtimeParity.strictSystem).toBe(true)
    expect(options.runtimeParity.stableFakeMetadata).toBe(true)
  })

  it("enables runtime parity only with explicit true or object config", () => {
    expect(resolveBridgeOptions({ runtimeParity: true }).runtimeParity).toMatchObject({
      enabled: true,
      cwd: undefined,
      scanClaudeMd: false,
      preReadFiles: false,
      mirrorMcpTools: true,
    })
  })

  it("merges runtime parity object options", () => {
    expect(
      resolveBridgeOptions({
        runtimeParity: {
          cwd: "/tmp/project",
          preReadFiles: true,
          preReadMessages: ["Called the Read tool fixture text"],
          hookSystemMessages: ["hook warning"],
          permissionSystemMessages: ["permission warning"],
        },
      }).runtimeParity,
    ).toMatchObject({
      enabled: true,
      cwd: "/tmp/project",
      preReadFiles: true,
      preReadMessages: ["Called the Read tool fixture text"],
      hookSystemMessages: ["hook warning"],
      permissionSystemMessages: ["permission warning"],
    })
  })

  it("does not enable cwd-backed memory scanning without an explicit cwd", () => {
    expect(resolveBridgeOptions({ runtimeParity: { scanClaudeMd: true, preReadFiles: true } }).runtimeParity).toMatchObject({
      enabled: true,
      cwd: undefined,
      scanClaudeMd: false,
      preReadFiles: true,
    })
  })
})
