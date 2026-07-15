import { describe, expect, it } from "vitest"
import { resolveBridgeOptions } from "../../src/config"
import { mirrorMcpTools, resolveMcpDomain } from "../../src/runtime/mcp"

const searchTool = {
  name: "mcp__demo__search",
  description: "Search",
  input_schema: { type: "object", properties: { query: { type: "string" } } },
}

describe("resolveMcpDomain", () => {
  it("automatically mirrors live OpenCode MCP tools and preserves Anthropic fields", () => {
    const result = resolveMcpDomain(
      {
        tools: [
          { name: "Bash", input_schema: { type: "object" } },
          { ...searchTool, cache_control: { type: "ephemeral" }, eager_input_streaming: true },
        ],
      },
      resolveBridgeOptions({ runtimeParity: { enabled: true } }),
    )

    expect(result.tools).toEqual([{ ...searchTool, cache_control: { type: "ephemeral" } }])
    expect(result.stateUsed).toEqual([
      { domain: "McpDomain", source: "opencode request tools", detail: "1 tool(s)" },
    ])
    expect(result.gaps).toEqual([])
  })

  it("returns no MCP state when runtime parity is disabled or mirror is opted out", () => {
    const input = { tools: [searchTool] }
    expect(resolveMcpDomain(input, resolveBridgeOptions({}))).toEqual({ tools: [], stateUsed: [], gaps: [] })
    expect(
      resolveMcpDomain(input, resolveBridgeOptions({ runtimeParity: { enabled: true, mirrorMcpTools: false } })),
    ).toEqual({ tools: [], stateUsed: [], gaps: [] })
  })

  it("uses live tools first and replay only for missing names", () => {
    const result = resolveMcpDomain(
      { tools: [searchTool] },
      resolveBridgeOptions({
        runtimeParity: {
          enabled: true,
          mcpTools: [
            { ...searchTool, description: "Stale replay" },
            { name: "mcp__replay__extra", description: "Extra", input_schema: { type: "object" } },
          ],
        },
      }),
    )

    expect(result.tools).toEqual([
      searchTool,
      { name: "mcp__replay__extra", description: "Extra", input_schema: { type: "object" } },
    ])
    expect(result.stateUsed).toEqual([
      { domain: "McpDomain", source: "opencode request tools", detail: "1 tool(s)" },
      { domain: "McpDomain", source: "runtimeParity.mcpTools", detail: "1 tool(s)" },
    ])
    expect(result.gaps).toEqual([])
  })

  it("ignores malformed replay definitions for names already supplied live", () => {
    const result = resolveMcpDomain(
      { tools: [searchTool] },
      resolveBridgeOptions({
        runtimeParity: {
          enabled: true,
          mcpTools: [{ name: searchTool.name, description: "Stale replay" }],
        },
      }),
    )

    expect(result.tools).toEqual([searchTool])
    expect(result.stateUsed).toEqual([
      { domain: "McpDomain", source: "opencode request tools", detail: "1 tool(s)" },
    ])
    expect(result.gaps).toEqual([])
  })

  it("deduplicates equal live definitions and gaps on conflicting live definitions", () => {
    const result = resolveMcpDomain(
      {
        tools: [
          searchTool,
          { ...searchTool, eager_input_streaming: true },
          { ...searchTool, description: "Conflicting description" },
        ],
      },
      resolveBridgeOptions({ runtimeParity: { enabled: true } }),
    )

    expect(result.tools).toEqual([searchTool])
    expect(result.gaps).toEqual([{ domain: "McpDomain", reason: "conflicting MCP tool definitions" }])
  })

  it("reports malformed MCP schemas without dropping valid tools", () => {
    const result = resolveMcpDomain(
      {
        tools: [
          searchTool,
          { name: "mcp__broken", input_schema: { type: "object" } },
          { name: "mcp__demo__missing_schema", description: "Missing" },
          { name: "mcp__demo__bad_description", description: 42, input_schema: { type: "object" } },
        ],
      },
      resolveBridgeOptions({ runtimeParity: { enabled: true } }),
    )

    expect(result.tools).toEqual([searchTool])
    expect(result.gaps).toEqual([
      { domain: "McpDomain", reason: "invalid MCP tool name" },
      { domain: "McpDomain", reason: "missing or invalid MCP input_schema" },
      { domain: "McpDomain", reason: "invalid MCP tool description" },
    ])
  })

  it("reports that OpenCode owns MCP execution even without cwd", () => {
    const result = resolveMcpDomain(
      { tools: [] },
      resolveBridgeOptions({ runtimeParity: { enabled: true, executeMcpServers: true } }),
    )

    expect(result.gaps).toEqual([
      {
        domain: "McpDomain",
        reason: "MCP server lifecycle is owned by OpenCode; independent execution is unsupported",
      },
    ])
  })

  it("keeps mirrorMcpTools as a narrow compatibility wrapper", () => {
    const options = resolveBridgeOptions({ runtimeParity: { enabled: true } })
    expect(mirrorMcpTools({ tools: [searchTool] }, options)).toEqual(resolveMcpDomain({ tools: [searchTool] }, options).tools)
  })
})
