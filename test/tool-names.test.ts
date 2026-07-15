import { describe, expect, it } from "vitest"
import { claudeCodeToolName, opencodeToolName } from "../src/transform/tool-names"

describe("tool name mapping", () => {
  it("maps opencode built-in names to Claude Code names", () => {
    expect(claudeCodeToolName("bash")).toBe("Bash")
    expect(claudeCodeToolName("edit")).toBe("Edit")
    expect(claudeCodeToolName("read")).toBe("Read")
    expect(claudeCodeToolName("glob")).toBe("Glob")
    expect(claudeCodeToolName("grep")).toBe("Grep")
    expect(claudeCodeToolName("write")).toBe("Write")
    expect(claudeCodeToolName("task")).toBe("Agent")
    expect(claudeCodeToolName("todowrite")).toBe("TodoWrite")
    expect(claudeCodeToolName("webfetch")).toBe("WebFetch")
    expect(claudeCodeToolName("skill")).toBe("Skill")
    expect(claudeCodeToolName("question")).toBe("AskUserQuestion")
  })

  it("maps Claude Code tool names back to opencode names", () => {
    expect(opencodeToolName("Bash")).toBe("bash")
    expect(opencodeToolName("Edit")).toBe("edit")
    expect(opencodeToolName("Read")).toBe("read")
    expect(opencodeToolName("Glob")).toBe("glob")
    expect(opencodeToolName("Grep")).toBe("grep")
    expect(opencodeToolName("Write")).toBe("write")
    expect(opencodeToolName("Agent")).toBe("task")
    expect(opencodeToolName("TodoWrite")).toBe("todowrite")
    expect(opencodeToolName("WebFetch")).toBe("webfetch")
    expect(opencodeToolName("Skill")).toBe("skill")
    expect(opencodeToolName("AskUserQuestion")).toBe("question")
  })

  it("leaves unmapped names unchanged", () => {
    expect(claudeCodeToolName("Bash")).toBe("Bash")
    expect(claudeCodeToolName("Read")).toBe("Read")
    expect(claudeCodeToolName("custom_tool")).toBe("custom_tool")
    expect(opencodeToolName("CustomTool")).toBe("CustomTool")
  })
})
