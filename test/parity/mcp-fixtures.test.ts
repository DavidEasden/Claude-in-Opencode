import { describe, expect, it } from "vitest"
import baselineJson from "../fixtures/parity/2.1.205-capture/full-single-turn.json"
import visibleJson from "../fixtures/parity/2.1.205-capture/mcp-visible-tools.json"
import replayJson from "../fixtures/parity/2.1.205-capture/mcp-explicit-replay.json"
import normalizationJson from "../fixtures/parity/2.1.205-capture/mcp-schema-normalization.json"
import invalidJson from "../fixtures/parity/2.1.205-capture/mcp-invalid-schema-gap.json"
import executionJson from "../fixtures/parity/2.1.205-capture/mcp-external-execution-gap.json"
import { compareBridgeToFixtureWithRuntime } from "../../src/parity/bridge"
import type { JsonObject, ParityFixture, ParityScenario, ParityVersion } from "../../src/parity/types"
import type { BridgeOptions } from "../../src/types"

const unsupportedText =
  "Phase 3D MCP fixture is bridge-generated and must be replaced by a sanitized Claude Code 2.1.205 golden capture before declaring external parity."

interface McpFixtureScaffold {
  version: ParityVersion
  scenario: ParityScenario
  runtimeInput: {
    tools?: JsonObject[]
    bridgeOptions: BridgeOptions
  }
  expectedMcpTools: JsonObject[]
  expectedGapReasons: string[]
  unsupported: string[]
}

const baseline = baselineJson as unknown as ParityFixture
const scaffolds = [visibleJson, replayJson, normalizationJson, invalidJson, executionJson] as unknown as McpFixtureScaffold[]

function buildFixture(scaffold: McpFixtureScaffold): { input: JsonObject; fixture: ParityFixture; bridgeOptions: BridgeOptions } {
  const baselineTools = Array.isArray(baseline.runtimeInput.tools) ? baseline.runtimeInput.tools : []
  const expectedTools = Array.isArray(baseline.expected.body.tools) ? baseline.expected.body.tools : []
  const input = {
    ...structuredClone(baseline.runtimeInput),
    tools: [...structuredClone(baselineTools), ...structuredClone(scaffold.runtimeInput.tools ?? [])],
  } as JsonObject
  const fixture: ParityFixture = {
    ...structuredClone(baseline),
    version: scaffold.version,
    scenario: structuredClone(scaffold.scenario),
    runtimeInput: input,
    expected: {
      ...structuredClone(baseline.expected),
      body: {
        ...structuredClone(baseline.expected.body),
        tools: [...structuredClone(expectedTools), ...structuredClone(scaffold.expectedMcpTools)],
      },
    },
    unsupported: [...scaffold.unsupported],
  }
  return { input, fixture, bridgeOptions: structuredClone(scaffold.runtimeInput.bridgeOptions) }
}

describe("Phase 3D MCP fixture scaffolds", () => {
  it.each(scaffolds)("evaluates bridge-generated MCP fixture $scenario.name", async (scaffold) => {
    expect(scaffold.version).toBe("2.1.205-capture")
    expect(scaffold.unsupported).toContain(unsupportedText)
    const { input, fixture, bridgeOptions } = buildFixture(scaffold)
    const result = await compareBridgeToFixtureWithRuntime(input, fixture, { bridgeOptions })

    expect(result.diff.equal).toBe(true)
    expect(result.runtimeContext.gaps.map((gap) => gap.reason)).toEqual(scaffold.expectedGapReasons)
    expect(result.gate.equivalent).toBe(scaffold.expectedGapReasons.length === 0)
  })
})
