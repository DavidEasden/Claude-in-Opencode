import { describe, expect, it } from "vitest"
import {
  CLAUDE_CODE_DEFAULT_TOOLS_MESSAGE,
  CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE,
  CLAUDE_CODE_OUTPUT_CONFIG,
  CLAUDE_CODE_SYSTEM,
  CLAUDE_CODE_TOOLS,
} from "../src/claude-code/template"

const capturedDefaultToolNames = [
  "Agent",
  "Bash",
  "CronCreate",
  "CronDelete",
  "CronList",
  "Edit",
  "EnterWorktree",
  "ExitWorktree",
  "NotebookEdit",
  "Read",
  "ReportFindings",
  "ScheduleWakeup",
  "SendMessage",
  "Skill",
  "TaskCreate",
  "TaskGet",
  "TaskList",
  "TaskOutput",
  "TaskStop",
  "TaskUpdate",
  "WebFetch",
  "WebSearch",
  "Workflow",
  "Write",
] as const

describe("Claude Code captured template", () => {
  it("uses the captured default effort", () => {
    expect(CLAUDE_CODE_OUTPUT_CONFIG.effort).toBe("high")
  })

  it("uses the captured 2.1.205 sdk-cli identity", () => {
    expect(CLAUDE_CODE_SYSTEM[0]).toMatchObject({
      type: "text",
      text: "x-anthropic-billing-header: cc_version=2.1.205.bcd; cc_entrypoint=sdk-cli;",
    })
    expect(CLAUDE_CODE_SYSTEM[1]).toMatchObject({
      type: "text",
      text: "You are a Claude agent, built on Anthropic's Claude Agent SDK.",
    })
  })

  it("uses the captured default tool names", () => {
    expect(CLAUDE_CODE_TOOLS.map((tool) => tool.name)).toEqual(capturedDefaultToolNames)
    expect(CLAUDE_CODE_TOOLS.map((tool) => tool.name)).not.toContain("ToolSearch")
  })

  it("announces the captured agent types and skills", () => {
    expect(CLAUDE_CODE_DEFAULT_TOOLS_MESSAGE.role).toBe("system")
    expect(CLAUDE_CODE_DEFAULT_TOOLS_MESSAGE.content).toMatch(
      /^Available agent types for the Agent tool:/,
    )
    expect(CLAUDE_CODE_DEFAULT_TOOLS_MESSAGE.content).toContain(
      "The following skills are available for use with the Skill tool:",
    )
    expect(CLAUDE_CODE_DEFAULT_TOOLS_MESSAGE.content).not.toContain("ToolSearch")
    expect(CLAUDE_CODE_DEFAULT_TOOLS_MESSAGE.content).not.toContain(
      "Fetches full schema definitions for deferred tools",
    )
  })

  it("keeps the legacy deferred export on the default tools message", () => {
    expect(CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE).toBe(CLAUDE_CODE_DEFAULT_TOOLS_MESSAGE)
  })
})
