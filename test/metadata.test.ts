import { describe, expect, it } from "vitest"
import captured from "./fixtures/claude-code-request.json"
import { resolveBridgeOptions } from "../src/config"
import { applyClaudeCodeMetadata } from "../src/transform/metadata"
import type { AnthropicRequestBody } from "../src/types"

describe("applyClaudeCodeMetadata", () => {
  it("uses captured Claude Code metadata and context management", () => {
    const body: AnthropicRequestBody = { model: "claude-opus-4-8", messages: [] }
    const result = applyClaudeCodeMetadata(body, { options: resolveBridgeOptions({}) })

    expect(result.metadata).toEqual(captured.metadata)
    expect(result.context_management).toEqual(captured.context_management)
  })

  it("serializes configured metadata fields into user_id", () => {
    const body: AnthropicRequestBody = { model: "claude-opus-4-8", messages: [] }
    const result = applyClaudeCodeMetadata(body, {
      sessionID: "runtime-session",
      options: resolveBridgeOptions({
        sessionId: "configured-session",
        deviceId: "configured-device",
        accountUuid: "configured-account",
      }),
    })

    expect(result.metadata).toEqual({
      user_id: JSON.stringify({
        device_id: "configured-device",
        account_uuid: "configured-account",
        session_id: "configured-session",
      }),
    })
    expect(result.context_management).toEqual(captured.context_management)
  })

  it("uses runtime session when configured session is absent", () => {
    const body: AnthropicRequestBody = { model: "claude-opus-4-8", messages: [] }
    const result = applyClaudeCodeMetadata(body, {
      sessionID: "runtime-session",
      options: resolveBridgeOptions({ deviceId: "configured-device" }),
    })

    expect(result.metadata).toEqual({
      user_id: JSON.stringify({
        device_id: "configured-device",
        account_uuid: "",
        session_id: "runtime-session",
      }),
    })
  })

  it("uses stable fake metadata only for source-compatible opt-in", () => {
    const result = applyClaudeCodeMetadata(
      { messages: [] },
      {
        options: resolveBridgeOptions({
          runtimeParity: { enabled: true, profile: "source-compatible", stableFakeMetadata: true },
        }),
      },
    )

    expect(result.metadata).toEqual({
      user_id: JSON.stringify({
        device_id: "bridge-device-00000000000000000000000000000000",
        account_uuid: "",
        session_id: "bridge-session-00000000-0000-4000-8000-000000000000",
      }),
    })
  })

  it("overwrites existing metadata and context management with captured values", () => {
    const body: AnthropicRequestBody = {
      metadata: { source: "test" },
      context_management: { keep: "wrong" },
    }
    const result = applyClaudeCodeMetadata(body, { options: resolveBridgeOptions({}) })

    expect(result.metadata).toEqual(captured.metadata)
    expect(result.context_management).toEqual(captured.context_management)
  })
})
