import { describe, expect, it } from "vitest"
import basic from "../fixtures/parity/2.1.205-capture/claude-md-basic.json"
import rules from "../fixtures/parity/2.1.205-capture/claude-rules.json"
import include from "../fixtures/parity/2.1.205-capture/claude-include.json"
import frontmatter from "../fixtures/parity/2.1.205-capture/claude-frontmatter-paths.json"
import parentBoundary from "../fixtures/parity/2.1.205-capture/claude-parent-boundary-gap.json"
import { compareBridgeToFixtureWithRuntime } from "../../src/parity/bridge"
import type { ParityFixture } from "../../src/parity/types"

const unsupportedText =
  "Phase 3B memory fixture is bridge-generated and must be replaced by a sanitized Claude Code 2.1.205 golden capture before declaring external parity."

const fixtures = [basic, rules, include, frontmatter] as unknown as ParityFixture[]

describe("Phase 3B memory fixtures", () => {
  it.each(fixtures)("round-trips bridge-generated memory fixture $scenario.name", async (fixture) => {
    expect(fixture.unsupported).toContain(unsupportedText)
    const result = await compareBridgeToFixtureWithRuntime(fixture.runtimeInput, fixture, {
      bridgeOptions: fixture.runtimeInput.bridgeOptions as never,
    })

    expect(result.runtimeContext.gaps).toEqual([])
    expect(result.gate.equivalent).toBe(true)
  })

  it("keeps parent-boundary fixture as a gap scenario", async () => {
    const fixture = parentBoundary as unknown as ParityFixture
    expect(fixture.unsupported).toContain(unsupportedText)
    const result = await compareBridgeToFixtureWithRuntime(fixture.runtimeInput, fixture, {
      bridgeOptions: fixture.runtimeInput.bridgeOptions as never,
    })

    expect(result.runtimeContext.gaps.map((gap) => gap.domain)).toContain("WorkspaceMemoryDomain")
    expect(result.gate.equivalent).toBe(false)
  })
})
