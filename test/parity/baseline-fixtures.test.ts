import { describe, expect, it } from "vitest"
import fullSingleTurn from "../fixtures/parity/2.1.205-capture/full-single-turn.json"
import multiTurn from "../fixtures/parity/2.1.205-capture/multi-turn.json"
import toolLoop from "../fixtures/parity/2.1.205-capture/tool-loop.json"
import { compareBridgeToFixtureWithRuntime } from "../../src/parity/bridge"
import type { ParityFixture } from "../../src/parity/types"

const fixtures = [fullSingleTurn, multiTurn, toolLoop] as unknown as ParityFixture[]

describe("Phase 3A baseline fixtures", () => {
  it.each(fixtures)("has full request body fields for $scenario.name", async (fixture) => {
    expect(fixture.version).toBe("2.1.205-capture")
    expect(fixture.expected.body.system).toBeDefined()
    expect(fixture.expected.body.messages).toBeDefined()
    expect(fixture.expected.body.tools).toBeDefined()
    expect(fixture.unsupported).toContain(
      "Phase 3A baseline fixture is bridge-generated and must be replaced by a sanitized Claude Code 2.1.205 golden capture before declaring external parity.",
    )
  })

  it.each(fixtures)("round-trips bridge-generated fixture $scenario.name without runtime gaps", async (fixture) => {
    const result = await compareBridgeToFixtureWithRuntime(fixture.runtimeInput, fixture, {
      bridgeOptions: { runtimeParity: { enabled: true, diagnostics: true } },
    })

    expect(result.runtimeContext.gaps).toEqual([])
    expect(result.gate.equivalent).toBe(true)
  })
})
