import { describe, expect, it } from "vitest"
import captured from "./fixtures/claude-code-request.json"
import fixture from "./fixtures/opencode-request.json"
import { resolveBridgeOptions } from "../src/config"
import { transformRequestBody } from "../src/transform/request"

describe("transformRequestBody", () => {
  it("matches captured Claude Code request shape for fixture user text", () => {
    const input = { ...fixture, extra_field: true, tool_choice: { type: "auto" } }
    const result = transformRequestBody(input, {
      requestURL: "https://api.anthropic.com/v1/messages",
      sessionID: "ses_test",
      options: resolveBridgeOptions({}),
    })
    const messages = result.messages as Array<{ role?: unknown; content?: unknown }>

    expect(Object.keys(result).sort()).toEqual(Object.keys(captured).sort())
    expect(Array.isArray(result.system)).toBe(true)
    expect(Array.isArray(result.tools)).toBe(true)
    expect((result as Record<string, unknown>).tool_choice).toBeUndefined()
    expect(Array.isArray(result.messages)).toBe(true)
    expect(messages).toHaveLength(captured.messages.length)
    expect(messages.map((message) => message.role)).toEqual(["user", "system"])
    expect(result.model).toBe(captured.model)
    expect(result.stream).toBe(captured.stream)
    expect(result.max_tokens).toBe(captured.max_tokens)
    expect(result.thinking).toEqual(captured.thinking)
    expect(result.output_config).toEqual({ effort: "high" })
    expect(result.context_management).toEqual(captured.context_management)
    expect(result.metadata).toEqual({
      user_id: JSON.stringify({
        device_id: "e2cf0b71e2614bd09821c5006fab451f055280cabee95abea1707b940bb9476b",
        account_uuid: "",
        session_id: "ses_test",
      }),
    })
  })

  it("keeps captured fixture unchanged with runtime parity disabled by default", () => {
    const result = transformRequestBody(fixture, {
      requestURL: "https://api.anthropic.com/v1/messages",
      sessionID: "ses_test",
      options: resolveBridgeOptions({}),
    })
    const tools = result.tools as Array<{ name: string }>
    const messages = JSON.stringify(result.messages)

    expect(Object.keys(result).sort()).toEqual(Object.keys(captured).sort())
    expect(messages).not.toContain("# claudeMd")
    expect(messages).not.toContain("Called the Read tool")
    expect(tools.some((tool) => tool.name.startsWith("mcp__"))).toBe(false)
  })

  it("applies runtime context to messages and tools", () => {
    const result = transformRequestBody(
      { messages: [{ role: "user", content: "summarize @sample.txt" }], tools: [] },
      {
        requestURL: "https://api.anthropic.com/v1/messages",
        sessionID: "runtime-session",
        options: resolveBridgeOptions({}),
        runtimeContext: {
          claudeMd: "runtime memory",
          insertedMessages: [{ role: "system", content: "Called the Read tool with the following input" }],
          mirroredMcpTools: [
            { name: "mcp__ida__check_connection", description: "Check IDA", input_schema: { type: "object" } },
          ],
          gaps: [],
          stateUsed: [],
        },
      },
    )

    const messages = result.messages as Array<{ role: string; content: unknown }>
    const tools = result.tools as Array<{ name: string }>
    expect(JSON.stringify(messages[0]?.content)).toContain("# claudeMd")
    expect(JSON.stringify(messages[0]?.content)).toContain("runtime memory")
    expect(JSON.stringify(messages[0]?.content)).toContain("# currentDate")
    expect(messages.at(-2)).toEqual({ role: "system", content: "Called the Read tool with the following input" })
    expect(tools.map((tool) => tool.name)).toContain("mcp__ida__check_connection")
  })

  it("uses captured top-level fields when input and options diverge from captured values", () => {
    const input = {
      ...fixture,
      model: "wrong-model",
      max_tokens: 1,
      thinking: { type: "adaptive", display: "summarized", budget_tokens: 123 },
      output_config: { effort: "max", extra: true },
      stream: false,
      tools: undefined,
      context_management: { keep: "wrong" },
    }

    const result = transformRequestBody(input, {
      requestURL: "https://api.anthropic.com/v1/messages",
      sessionID: "ses_test",
      options: resolveBridgeOptions({ maxTokens: 1, effortMap: { max: "wrong" }, removeEagerInputStreaming: false }),
    })

    expect(result.model).toBe(captured.model)
    expect(result.max_tokens).toBe(captured.max_tokens)
    expect(result.thinking).toEqual(captured.thinking)
    expect(result.output_config).toEqual({ effort: "high" })
    expect(result.stream).toBe(captured.stream)
    expect(result.context_management).toEqual(captured.context_management)
    expect(Array.isArray(result.tools)).toBe(true)
  })

  it("uses configured metadata and effort in transformed request", () => {
    const result = transformRequestBody(fixture, {
      requestURL: "https://api.anthropic.com/v1/messages",
      sessionID: "runtime-session",
      options: resolveBridgeOptions({
        effort: "xhigh",
        sessionId: "configured-session",
        deviceId: "configured-device",
        accountUuid: "configured-account",
      }),
    })

    expect(result.output_config).toEqual({ effort: "xhigh" })
    expect(result.metadata).toEqual({
      user_id: JSON.stringify({
        device_id: "configured-device",
        account_uuid: "configured-account",
        session_id: "configured-session",
      }),
    })
  })

  it("transforms the sanitized OpenCode fixture into the Claude Code request shape", () => {
    const input = fixture

    const result = transformRequestBody(input, {
      requestURL: "https://api.anthropic.com/v1/messages",
      sessionID: "ignored",
      options: resolveBridgeOptions({}),
    })

    expect(result.model).toBe(captured.model)
    expect(result.max_tokens).toBe(captured.max_tokens)
    expect(Array.isArray(result.messages)).toBe(true)
    expect(result.output_config).toEqual({ effort: "high" })
    expect(result.metadata).toEqual({
      user_id: JSON.stringify({
        device_id: "e2cf0b71e2614bd09821c5006fab451f055280cabee95abea1707b940bb9476b",
        account_uuid: "",
        session_id: "ignored",
      }),
    })
  })

  it("adds source-compatible billing header and removes spoofed billing text when opted in", () => {
    const result = transformRequestBody(
      {
        system: [{ type: "text", text: "x-anthropic-billing-header: cc_version=fake" }],
        messages: [{ role: "user", content: [{ type: "text", text: "abcdefghijklmnopqrstuvwxyz" }] }],
      },
      {
        requestURL: "https://api.anthropic.com/v1/messages",
        options: resolveBridgeOptions({ runtimeParity: { enabled: true, profile: "source-compatible", strictSystem: true } }),
      },
    )

    const systemText = JSON.stringify(result.system)
    const billingHeaders = systemText.match(/x-anthropic-billing-header:/g) ?? []
    expect(systemText).toContain(
      "x-anthropic-billing-header: cc_version=2.1.205.1e2; cc_entrypoint=cli; cch=00000;",
    )
    expect(billingHeaders).toHaveLength(1)
    expect(systemText).not.toContain("cc_version=2.1.205.bcd; cc_entrypoint=sdk-cli;")
    expect(systemText).not.toContain("cc_version=fake")
  })
})
