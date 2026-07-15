import { describe, expect, it } from "vitest"
import { computeBillingHeaderText } from "../../src/profile/billing"
import { cleanupAnthropicRequest } from "../../src/profile/cleanup"

describe("profile billing and cleanup", () => {
  it("computes deterministic Claude Code billing header text", () => {
    expect(computeBillingHeaderText({ firstUserText: "abcdefghijklmnopqrstuvwxyz", cliVersion: "2.1.205" })).toMatch(
      /^x-anthropic-billing-header: cc_version=2\.1\.205\.[a-f0-9]{3}; cc_entrypoint=cli; cch=00000;$/,
    )
  })

  it("removes spoofed billing system blocks and empty message text", () => {
    const cleaned = cleanupAnthropicRequest(
      {
        system: [
          { type: "text", text: "x-anthropic-billing-header: cc_version=fake" },
          { type: "text", text: "keep system" },
        ],
        messages: [
          { role: "user", content: [{ type: "text", text: "" }] },
          { role: "user", content: [{ type: "text", text: "keep" }] },
        ],
      },
      { strictSystem: false },
    ) as { system: unknown[]; messages: unknown[] }

    expect(cleaned.system).toEqual([{ type: "text", text: "keep system" }])
    expect(cleaned.messages).toEqual([{ role: "user", content: [{ type: "text", text: "keep" }] }])
  })
})
