import { describe, expect, it } from "vitest"
import { buildClaudeCodeHeaders } from "../../src/profile/headers"

describe("buildClaudeCodeHeaders", () => {
  it("builds source-compatible Claude Code shell headers", () => {
    const headers = buildClaudeCodeHeaders({
      originalHeaders: {
        "content-type": "application/json",
        "x-api-key": "keep-key",
        authorization: "Bearer keep-auth",
      },
      cliVersion: "2.1.205",
      sdkVersion: "0.94.0",
      sessionId: "ses_profile",
      stream: true,
      body: { model: "claude-sonnet-4-20250514", output_config: { effort: "high" } },
    })

    expect(headers.get("x-api-key")).toBe("keep-key")
    expect(headers.get("authorization")).toBe("Bearer keep-auth")
    expect(headers.get("user-agent")).toBe("claude-cli/2.1.205 (external, cli)")
    expect(headers.get("x-app")).toBe("cli")
    expect(headers.get("anthropic-version")).toBe("2023-06-01")
    expect(headers.get("anthropic-dangerous-direct-browser-access")).toBe("true")
    expect(headers.get("x-claude-code-session-id")).toBe("ses_profile")
    expect(headers.get("x-stainless-lang")).toBe("js")
    expect(headers.get("x-stainless-package-version")).toBe("0.94.0")
    expect(headers.get("x-stainless-helper-method")).toBe("stream")
    expect(headers.get("anthropic-beta")).toContain("claude-code-20250219")
    expect(headers.get("anthropic-beta")).toContain("interleaved-thinking-2025-05-14")
    expect(headers.get("anthropic-beta")).toContain("effort-2025-11-24")
  })
})
