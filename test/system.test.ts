import { describe, expect, it } from "vitest"
import { CLAUDE_CODE_SYSTEM } from "../src/claude-code/template"
import { transformSystem } from "../src/transform/system"

describe("transformSystem", () => {
  it("ignores legacy system toggles and returns captured Claude Code system blocks", () => {
    const result = transformSystem(
      [{ type: "text", text: "You are OpenCode, the best coding agent on the planet.\nFollow user instructions." }],
      { includeBillingHeader: false, rewriteSystemIdentity: false },
    )

    expect(result).toEqual(CLAUDE_CODE_SYSTEM)
    expect(result.map((block) => block.text).join("\n")).not.toContain("You are OpenCode")
  })

  it("returns a cloned system template", () => {
    const result = transformSystem([], { includeBillingHeader: true, rewriteSystemIdentity: true })
    result[0]!.text = "mutated"

    expect(transformSystem([], { includeBillingHeader: true, rewriteSystemIdentity: true })[0]?.text).toBe(
      CLAUDE_CODE_SYSTEM[0]?.text,
    )
  })

  it("replaces the default agent system prompt with a configured prompt", () => {
    const result = transformSystem([], {
      includeBillingHeader: true,
      rewriteSystemIdentity: true,
      systemPrompt: "You are a project-specific Claude agent.",
    })

    expect(result[0]).toEqual(CLAUDE_CODE_SYSTEM[0])
    expect(result[1]).toEqual(CLAUDE_CODE_SYSTEM[1])
    expect(result[2]).toEqual({
      ...CLAUDE_CODE_SYSTEM[2],
      text: "You are a project-specific Claude agent.",
    })
  })

  it("appends a configured prompt to the default agent system prompt", () => {
    const appendSystemPrompt = "Always prefer small, targeted changes."
    const result = transformSystem([], {
      includeBillingHeader: true,
      rewriteSystemIdentity: true,
      appendSystemPrompt,
    })

    expect(result[2]?.text).toBe(`${CLAUDE_CODE_SYSTEM[2]?.text}\n\n${appendSystemPrompt}`)
  })
})
