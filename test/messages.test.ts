import { describe, expect, it } from "vitest"
import {
  CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE,
  CLAUDE_CODE_DEFAULT_TOOLS_MESSAGE,
  CLAUDE_CODE_USER_CONTEXT_BLOCK,
} from "../src/claude-code/template"
import { transformMessages } from "../src/transform/messages"

describe("transformMessages", () => {
  it("returns non-array input unchanged", () => {
    const input = { role: "user", content: "hi" }

    expect(transformMessages(input)).toBe(input)
  })

  it("wraps OpenCode user text with Claude Code context and deferred tools message", () => {
    const messages = [{ role: "user", content: [{ type: "text", text: "你是谁？" }] }]

    const result = transformMessages(messages)

    expect(result).toEqual([
      {
        role: "user",
        content: [CLAUDE_CODE_USER_CONTEXT_BLOCK, { type: "text", text: "你是谁？", cache_control: { type: "ephemeral" } }],
      },
      CLAUDE_CODE_DEFAULT_TOOLS_MESSAGE,
    ])
  })

  it("preserves Claude Code-style chronological text history", () => {
    const result = transformMessages([
      { role: "user", content: [{ type: "text", text: "First turn", cache_control: { type: "ephemeral" } }] },
      { role: "assistant", content: [{ type: "text", text: "first answer", cache_control: { type: "ephemeral" } }] },
      { role: "user", content: [{ type: "text", text: "Second turn", cache_control: { type: "ephemeral" } }] },
    ]) as Array<{ role: string; content: Array<Record<string, unknown>> }>

    expect(result[0]?.role).toBe("user")
    expect(result[0]?.content[0]).toEqual(CLAUDE_CODE_USER_CONTEXT_BLOCK)
    expect(result[0]?.content[1]).toEqual({ type: "text", text: "First turn" })
    expect(result[1]).toEqual({ role: "assistant", content: [{ type: "text", text: "first answer" }] })
    expect(result[2]).toEqual({
      role: "user",
      content: [{ type: "text", text: "Second turn", cache_control: { type: "ephemeral" } }],
    })
    expect(result.at(-1)).toEqual(CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE)
  })

  it("does not duplicate Claude Code context when input already includes it", () => {
    const messages = [
      {
        role: "user",
        content: [CLAUDE_CODE_USER_CONTEXT_BLOCK, { type: "text", text: "Already has context" }],
      },
    ]

    const result = transformMessages(messages) as Array<{ role: string; content: Array<Record<string, unknown>> }>
    const contextBlocks = result[0]?.content.filter((block) => block.text === CLAUDE_CODE_USER_CONTEXT_BLOCK.text)

    expect(contextBlocks).toHaveLength(1)
    expect(result[0]?.content[0]).toEqual(CLAUDE_CODE_USER_CONTEXT_BLOCK)
  })

  it("short-circuits when deferred tools message is already present", () => {
    const messages = [
      { role: "user", content: [CLAUDE_CODE_USER_CONTEXT_BLOCK, { type: "text", text: "Already transformed" }] },
      CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE,
    ]
    const result = transformMessages(messages) as typeof messages

    expect(result).toEqual(messages)
  })

  it("normalizes tool continuation blocks", () => {
    const result = transformMessages([
      { role: "user", content: [{ type: "text", text: "Run pwd" }] },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_1",
            name: "bash",
            input: { command: "pwd" },
            caller: "opencode",
            cache_control: { type: "ephemeral" },
          },
        ],
      },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "/tmp/project", is_error: true }] },
    ]) as Array<{ role: string; content: Array<Record<string, unknown>> }>

    expect(result[1]?.content[0]).toEqual({
      type: "tool_use",
      id: "toolu_1",
      name: "Bash",
      input: { command: "pwd" },
    })
    expect(result[2]?.content[0]).toEqual({
      type: "tool_result",
      tool_use_id: "toolu_1",
      content: "/tmp/project",
      cache_control: { type: "ephemeral" },
      is_error: true,
    })
  })

  it("maps question tool_use blocks in continuations", () => {
    const result = transformMessages([
      { role: "user", content: [{ type: "text", text: "Need input" }] },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_question",
            name: "question",
            input: { question: "Choose one", options: ["A", "B"] },
            caller: "opencode",
            cache_control: { type: "ephemeral" },
          },
        ],
      },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_question", content: "A" }] },
    ]) as Array<{ role: string; content: Array<Record<string, unknown>> }>

    expect(result[1]?.content[0]).toEqual({
      type: "tool_use",
      id: "toolu_question",
      name: "AskUserQuestion",
      input: { question: "Choose one", options: ["A", "B"] },
    })
  })

  it("clones unknown content blocks", () => {
    const unknownBlock = { type: "unknown_block", nested: { value: "before" } }
    const result = transformMessages([{ role: "assistant", content: [unknownBlock] }]) as Array<{
      role: string
      content: Array<{ type: string; nested?: { value: string } }>
    }>
    const resultBlock = result[0]?.content[0]

    expect(resultBlock).toEqual(unknownBlock)
    expect(resultBlock).not.toBe(unknownBlock)
    expect(resultBlock?.nested).not.toBe(unknownBlock.nested)

    unknownBlock.nested.value = "after"

    expect(resultBlock?.nested?.value).toBe("before")
  })

  it("returns cloned Claude Code messages", () => {
    type MutableDeferredToolsMessage = { role: string; content: string }
    const originalContent = CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE.content
    const messages = [{ role: "user", content: "hi" }]
    const result = transformMessages(messages) as unknown[]
    const appendedMessage = result[result.length - 1] as MutableDeferredToolsMessage

    try {
      appendedMessage.content = "mutated deferred tools content"

      expect(CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE.content).toBe(originalContent)
      expect(appendedMessage).not.toBe(CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE)
    } finally {
      ;(CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE as unknown as MutableDeferredToolsMessage).content = originalContent
    }
  })

  it("uses configured currentDate in the first user context reminder", () => {
    const result = transformMessages([{ role: "user", content: "hi" }], { currentDate: "2026-07-11" }) as Array<{
      role: string
      content: Array<Record<string, unknown>>
    }>

    expect(result[0]?.content[0]?.text).toContain("Today's date is 2026-07-11.")
    expect(result[0]?.content[0]?.text).not.toContain("Today's date is 2026-07-09.")
  })

  it("uses configured userContextBlock instead of the default context reminder", () => {
    const userContextBlock = "<system-reminder>Custom workspace context</system-reminder>"
    const result = transformMessages([{ role: "user", content: "hi" }], { userContextBlock }) as Array<{
      role: string
      content: Array<Record<string, unknown>>
    }>

    expect(result[0]?.content[0]).toEqual({ type: "text", text: userContextBlock })
  })

  it("appends runtime CLAUDE.md content inside the default context reminder", () => {
    const result = transformMessages([{ role: "user", content: "say ok" }], { claudeMd: "Codebase instructions" }) as Array<{
      role: string
      content: Array<Record<string, unknown>>
    }>

    expect(result[0]?.content[0]?.text).toContain("# claudeMd\nCodebase instructions")
    expect(result[0]?.content[0]?.text).toContain("# currentDate")
    expect(result[0]?.content[1]).toEqual({ type: "text", text: "say ok", cache_control: { type: "ephemeral" } })
  })

  it("inserts runtime system messages before the default tools message", () => {
    const insertedMessages: Array<{ role: "system"; content: string }> = [
      { role: "system", content: "Called the Read tool with captured fixture output" },
      { role: "system", content: "PreToolUse hook warned about Bash" },
      { role: "system", content: "Permission denied for Write" },
    ]
    const result = transformMessages([{ role: "user", content: "summarize @sample.txt" }], {
      insertedMessages,
    }) as Array<{ role: string; content: unknown }>

    expect(result.slice(-4)).toEqual([...insertedMessages, CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE])
    expect(result.at(-1)).toEqual(CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE)
  })
})
