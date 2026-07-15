import { describe, expect, it } from "vitest"
import opencodeRequest from "../fixtures/opencode-request.json"
import seedFixture from "../fixtures/parity/2.1.205-capture/single-turn.json"
import { compareBridgeToFixture, compareBridgeToFixtureWithRuntime } from "../../src/parity/bridge"
import type { ParityFixture } from "../../src/parity/types"

describe("bridge parity comparison", () => {
  it("compares bridge output to the seed fixture without exposing secrets", () => {
    const result = compareBridgeToFixture(opencodeRequest, seedFixture as ParityFixture, {
      sessionID: "$SESSION_ID",
    })

    expect(JSON.stringify(result.actual)).not.toContain("sk-ant")
    expect(result.diff.diffs.map((diff) => diff.path)).not.toContain("body.output_config.effort")
  })

  it("compares bridge output with runtime context and parity gate", async () => {
    const fixture = {
      ...(seedFixture as ParityFixture),
      expected: {
        ...(seedFixture as ParityFixture).expected,
        body: {},
      },
    }

    const result = await compareBridgeToFixtureWithRuntime({ messages: [] }, fixture, {
      bridgeOptions: { runtimeParity: { enabled: true, diagnostics: true } },
    })

    expect(result.runtimeContext).toMatchObject({ gaps: [], stateUsed: [] })
    expect(result.gate.diffCount).toBeGreaterThan(0)
    expect(result.gate.equivalent).toBe(false)
  })

  it("marks runtime comparison not equivalent when gaps exist", async () => {
    const requestWithAttachment = {
      ...opencodeRequest,
      messages: [{ role: "user", content: [{ type: "text", text: "summarize @sample.txt" }] }],
    }
    const result = await compareBridgeToFixtureWithRuntime(requestWithAttachment, seedFixture as ParityFixture, {
      bridgeOptions: {
        runtimeParity: {
          cwd: "/tmp/project",
          preReadFiles: true,
        },
      },
    })

    expect(result.runtimeContext.gaps.map((gap) => gap.domain)).toEqual(["AttachmentDomain"])
    expect(result.gate.equivalent).toBe(false)
    expect(result.gate.gapCount).toBe(1)
  })

  it("marks runtime comparison not equivalent when runtime profile is not the capture target", async () => {
    const result = await compareBridgeToFixtureWithRuntime(opencodeRequest, seedFixture as ParityFixture, {
      bridgeOptions: { runtimeParity: { profile: "source-compatible" } },
    })

    expect(result.gate.equivalent).toBe(false)
    expect(result.gate.reasons).toContain("runtime profile must be 2.1.205-capture (received source-compatible)")
  })
})
