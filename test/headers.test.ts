import { describe, expect, it } from "vitest"
import { getHeader, isAnthropicMessagesURL, sessionIDFromHeaders } from "../src/headers"

describe("headers", () => {
  it("reads headers from plain records", () => {
    expect(getHeader({ "X-Session-Id": "ses_1" }, "x-session-id")).toBe("ses_1")
  })

  it("extracts session id", () => {
    expect(sessionIDFromHeaders({ "x-session-id": "ses_1" })).toBe("ses_1")
    expect(sessionIDFromHeaders({ session_id: "ses_2" })).toBe("ses_2")
  })

  it("recognizes Anthropic messages endpoint", () => {
    expect(isAnthropicMessagesURL("https://api.anthropic.com/v1/messages")).toBe(true)
    expect(isAnthropicMessagesURL("https://api.anthropic.com/v1/models")).toBe(false)
  })
})
