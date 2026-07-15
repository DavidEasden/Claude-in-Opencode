import * as fs from "node:fs/promises"
import { describe, expect, it, vi } from "vitest"
import { resolveBridgeOptions } from "../../src/config"
import { createRuntimeParityContext } from "../../src/runtime/context"
import { createRuntimeParityState } from "../../src/runtime/state"

vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
  readFile: vi.fn(async () => {
    throw new Error("readFile should not be called")
  }),
}))

describe("createRuntimeParityContext", () => {
  it("returns an empty context when runtime parity is disabled", async () => {
    const state = createRuntimeParityState()
    const context = await createRuntimeParityContext(
      { messages: [] },
      {
        options: resolveBridgeOptions({ runtimeParity: false }),
        sessionID: "session-1",
        state,
      },
    )

    expect(context).toEqual({ insertedMessages: [], mirroredMcpTools: [], gaps: [], stateUsed: [] })
  })

  it("returns an empty enabled context before runtime stages are implemented", async () => {
    const state = createRuntimeParityState()
    const context = await createRuntimeParityContext(
      { messages: [] },
      {
        options: resolveBridgeOptions({ runtimeParity: { cwd: "/tmp/project" } }),
        sessionID: "session-1",
        state,
      },
    )

    expect(context.insertedMessages).toEqual([])
    expect(context.mirroredMcpTools).toEqual([])
    expect(context.gaps).toEqual([])
  })

  it("returns an empty context for default options", async () => {
    const readFile = vi.mocked(fs.readFile)
    readFile.mockClear()
    const state = createRuntimeParityState()
    const context = await createRuntimeParityContext(
      { messages: [{ role: "user", content: "hi" }] },
      {
        options: resolveBridgeOptions({}),
        sessionID: "session-1",
        state,
      },
    )

    expect(context).toEqual({ insertedMessages: [], mirroredMcpTools: [], gaps: [], stateUsed: [] })
    expect(readFile).not.toHaveBeenCalled()
  })

  it("returns an empty runtime gap list by default", async () => {
    const context = await createRuntimeParityContext(
      { messages: [] },
      {
        options: resolveBridgeOptions({ runtimeParity: { enabled: true, diagnostics: true } }),
        state: createRuntimeParityState(),
      },
    )

    expect(context.gaps).toEqual([])
  })

  it("merges OpenCode MCP tools, evidence, and schema gaps", async () => {
    const context = await createRuntimeParityContext(
      {
        messages: [],
        tools: [
          { name: "mcp__demo__search", description: "Search", input_schema: { type: "object" } },
          { name: "mcp__broken", input_schema: { type: "object" } },
        ],
      },
      {
        options: resolveBridgeOptions({ runtimeParity: { enabled: true } }),
        state: createRuntimeParityState(),
      },
    )

    expect(context.mirroredMcpTools.map((tool) => tool.name)).toEqual(["mcp__demo__search"])
    expect(context.stateUsed).toContainEqual({
      domain: "McpDomain",
      source: "opencode request tools",
      detail: "1 tool(s)",
    })
    expect(context.gaps).toContainEqual({ domain: "McpDomain", reason: "invalid MCP tool name" })
  })

  it("records replayed runtime state evidence", async () => {
    const context = await createRuntimeParityContext(
      {
        tools: [{ name: "mcp__demo__search", input_schema: { type: "object" }, eager_input_streaming: true }],
        messages: [],
      },
      {
        options: resolveBridgeOptions({
          runtimeParity: {
            enabled: true,
            preReadFiles: true,
            preReadMessages: ["Read tool fixture"],
            simulateHooks: true,
            hookSystemMessages: ["Hook fixture"],
            simulatePermissions: true,
            permissionSystemMessages: ["Permission fixture"],
            mirrorMcpTools: true,
          },
        }),
        state: createRuntimeParityState(),
      },
    )

    expect(context.insertedMessages.map((message) => message.content)).toEqual([
      "Read tool fixture",
      "Hook fixture",
      "Permission fixture",
    ])
    expect(context.mirroredMcpTools.map((tool) => tool.name)).toEqual(["mcp__demo__search"])
    expect(context.stateUsed).toEqual([
      { domain: "AttachmentDomain", source: "runtimeParity.preReadMessages", detail: "1 message(s)" },
      { domain: "McpDomain", source: "opencode request tools", detail: "1 tool(s)" },
      { domain: "HooksPermissionDomain", source: "runtimeParity.hookSystemMessages", detail: "1 message(s)" },
      { domain: "HooksPermissionDomain", source: "runtimeParity.permissionSystemMessages", detail: "1 message(s)" },
    ])
    expect(context.gaps).toEqual([])
  })

  it("reports high-permission domain gaps before domain implementations exist", async () => {
    const context = await createRuntimeParityContext(
      { messages: [{ role: "user", content: "Read @src/index.ts" }] },
      {
        options: resolveBridgeOptions({
          runtimeParity: {
            cwd: "/tmp/project",
            readWorkspaceFiles: true,
            executeMcpServers: true,
            executeHooks: true,
          },
        }),
        state: createRuntimeParityState(),
      },
    )

    expect(context.gaps).toEqual([
      {
        domain: "McpDomain",
        reason: "MCP server lifecycle is owned by OpenCode; independent execution is unsupported",
      },
      { domain: "HooksPermissionDomain", reason: "executeHooks requires Phase 3E hook executor" },
    ])
  })

  it("inserts automatic @file messages before hook and permission messages", async () => {
    const { mkdtemp, writeFile } = await import("node:fs/promises")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const cwd = await mkdtemp(join(tmpdir(), "bridge-context-attachments-"))
    await writeFile(join(cwd, "sample.txt"), "alpha beta")
    vi.mocked(fs.readFile).mockResolvedValueOnce(Buffer.from("alpha beta"))

    const context = await createRuntimeParityContext(
      { messages: [{ role: "user", content: "summarize @sample.txt" }] },
      {
        options: resolveBridgeOptions({
          runtimeParity: {
            cwd,
            preReadFiles: true,
            readWorkspaceFiles: true,
            simulateHooks: true,
            hookSystemMessages: ["Hook fixture"],
            simulatePermissions: true,
            permissionSystemMessages: ["Permission fixture"],
          },
        }),
        state: createRuntimeParityState(),
      },
    )

    expect(context.insertedMessages.map((message) => message.content)).toEqual([
      "Bridge-generated automatic @file pre-read for sample.txt\n\nalpha beta",
      "Hook fixture",
      "Permission fixture",
    ])
    expect(context.stateUsed).toContainEqual({ domain: "AttachmentDomain", source: "runtimeParity.cwd", detail: "sample.txt" })
    expect(context.gaps).toEqual([])
  })

  it("reports an AttachmentDomain gate gap when @file mentions are present but disk reads are not fully enabled", async () => {
    const context = await createRuntimeParityContext(
      { messages: [{ role: "user", content: "summarize @sample.txt" }] },
      {
        options: resolveBridgeOptions({ runtimeParity: { cwd: "/tmp/project", preReadFiles: true } }),
        state: createRuntimeParityState(),
      },
    )

    expect(context.gaps).toEqual([
      { domain: "AttachmentDomain", reason: "automatic @file reads require readWorkspaceFiles and runtimeParity.cwd" },
    ])
  })
})
