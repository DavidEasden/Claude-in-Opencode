import { describe, expect, it } from "vitest"
import { resolveBridgeOptions } from "../../src/config"
import { preReadSystemMessages } from "../../src/runtime/pre-read"

describe("preReadSystemMessages", () => {
  it("mirrors caller-supplied pre-read messages when explicitly enabled", () => {
    const result = preReadSystemMessages(
      resolveBridgeOptions({
        runtimeParity: {
          preReadFiles: true,
          preReadMessages: ["Called the Read tool with captured fixture output"],
        },
      }),
    )

    expect(result).toEqual([{ role: "system", content: "Called the Read tool with captured fixture output" }])
  })

  it("returns no messages by default", () => {
    expect(preReadSystemMessages(resolveBridgeOptions({}))).toEqual([])
  })

  it("returns no messages unless pre-read files are explicitly enabled", () => {
    expect(
      preReadSystemMessages(
        resolveBridgeOptions({
          runtimeParity: { preReadMessages: ["Called the Read tool with captured fixture output"] },
        }),
      ),
    ).toEqual([])
  })
})
