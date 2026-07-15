import { describe, expect, it } from "vitest"
import { CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE, CLAUDE_CODE_TOOLS } from "../src/claude-code/template"
import { resolveBridgeOptions } from "../src/config"
import { transformRequestBody } from "../src/transform/request"
import { transformTools } from "../src/transform/tools"

const defaultTools = structuredClone(CLAUDE_CODE_TOOLS)
const bashReadTools = defaultTools.filter((tool) => tool.name === "Bash" || tool.name === "Read")

describe("transformTools", () => {
  it("replaces opencode tools with captured Claude Code tools", () => {
    const result = transformTools([
      { name: "bash", description: "Run shell", input_schema: { type: "object", $schema: "https://json-schema.org/draft/2020-12/schema" }, eager_input_streaming: true },
    ])

    expect(result).toEqual(defaultTools)
  })

  it("returns captured Claude Code tools for non-array values", () => {
    expect(transformTools(undefined)).toEqual(defaultTools)
  })

  it("does not let callers mutate CLAUDE_CODE_TOOLS through returned tools", () => {
    const result = transformTools(undefined) as Array<{ name: string }>

    result[0].name = "mutated"

    expect(CLAUDE_CODE_TOOLS[0].name).toBe(defaultTools[0]?.name)
    expect(transformTools(undefined)).toEqual(defaultTools)
  })

  it("returns no tools when toolNames is an explicit empty list", () => {
    expect(transformTools(undefined, { toolNames: [] })).toEqual([])
  })

  it("returns requested default tools in captured order for opencode or Claude Code names", () => {
    const result = transformTools(undefined, { toolNames: ["read", "bash", "UnknownTool", "Bash"] }) as Array<{ name: string }>

    expect(result.map((tool) => tool.name)).toEqual(["Bash", "Read"])
    expect(result).toEqual(bashReadTools)
  })

  it("appends mirrored MCP tools for the default tool set", () => {
    const result = transformTools(undefined, {}, [
      { name: "mcp__ida__check_connection", description: "Check IDA", input_schema: { type: "object" } },
    ]) as Array<{ name: string }>

    expect(result.map((tool) => tool.name)).toContain("Bash")
    expect(result.map((tool) => tool.name)).toContain("mcp__ida__check_connection")
  })

  it("appends MCP runtime tools even when built-in toolNames are filtered", () => {
    const mcpTool = { name: "mcp__demo__search", description: "Search", input_schema: { type: "object" } }
    const result = transformTools([], { toolNames: ["Bash"] }, [mcpTool]) as Array<{ name: string }>

    expect(result.map((tool) => tool.name)).toEqual(["Bash", "mcp__demo__search"])
  })

  it("omits the default tools message when toolNames is explicit", () => {
    const result = transformRequestBody({ messages: [{ role: "user", content: "hello" }] }, {
      requestURL: "https://api.anthropic.com/v1/messages",
      options: resolveBridgeOptions({ toolNames: ["bash", "read"] }),
    })

    expect(result.tools).toEqual(bashReadTools)
    expect(result.messages).not.toContainEqual(CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE)
  })

  it("omits all tools and the default tools message when toolNames is empty", () => {
    const result = transformRequestBody({ messages: [{ role: "user", content: "hello" }] }, {
      requestURL: "https://api.anthropic.com/v1/messages",
      options: resolveBridgeOptions({ toolNames: [] }),
    })

    expect(result.tools).toEqual([])
    expect(result.messages).not.toContainEqual(CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE)
  })
})
