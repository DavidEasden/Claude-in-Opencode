import { describe, expect, it } from "vitest"
import { resolveBridgeOptions } from "../../src/config"
import { runtimeSystemMessages } from "../../src/runtime/hooks"

describe("runtimeSystemMessages", () => {
  it("formats explicit hook and permission messages", () => {
    const result = runtimeSystemMessages(
      resolveBridgeOptions({
        runtimeParity: {
          simulateHooks: true,
          simulatePermissions: true,
          hookSystemMessages: ["PreToolUse hook warned about Bash"],
          permissionSystemMessages: ["Permission denied for Write"],
        },
      }),
    )

    expect(result).toEqual([
      { role: "system", content: "PreToolUse hook warned about Bash" },
      { role: "system", content: "Permission denied for Write" },
    ])
  })

  it("returns no messages by default", () => {
    expect(runtimeSystemMessages(resolveBridgeOptions({}))).toEqual([])
  })

  it("requires hook and permission simulation to be explicitly enabled", () => {
    const result = runtimeSystemMessages(
      resolveBridgeOptions({
        runtimeParity: {
          hookSystemMessages: ["PreToolUse hook warned about Bash"],
          permissionSystemMessages: ["Permission denied for Write"],
        },
      }),
    )

    expect(result).toEqual([])
  })
})
