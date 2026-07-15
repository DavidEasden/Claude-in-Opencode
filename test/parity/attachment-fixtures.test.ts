import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import text from "../fixtures/parity/2.1.205-capture/at-file-text.json"
import lineRange from "../fixtures/parity/2.1.205-capture/at-file-line-range.json"
import quotedPath from "../fixtures/parity/2.1.205-capture/at-file-quoted-path.json"
import missingGap from "../fixtures/parity/2.1.205-capture/at-file-missing-gap.json"
import binaryGap from "../fixtures/parity/2.1.205-capture/at-file-binary-gap.json"
import { compareBridgeToFixtureWithRuntime } from "../../src/parity/bridge"
import type { ParityFixture } from "../../src/parity/types"

const unsupportedText =
  "Phase 3C attachment fixture is bridge-generated and must be replaced by a sanitized Claude Code 2.1.205 golden capture before declaring external parity."

const equivalentFixtures = [text, lineRange, quotedPath] as unknown as ParityFixture[]
const gapFixtures = [missingGap, binaryGap] as unknown as ParityFixture[]

async function withFixtureWorkspace(fixture: ParityFixture): Promise<ParityFixture> {
  const cwd = await mkdtemp(join(tmpdir(), `bridge-attachment-fixture-${fixture.scenario.name}-`))
  await mkdir(join(cwd, "src"), { recursive: true })
  await mkdir(join(cwd, "docs"), { recursive: true })
  await writeFile(join(cwd, "src", "a.ts"), "one\ntwo\nthree\n")
  await writeFile(join(cwd, "docs", "with spaces.md"), "quoted path content\n")
  await writeFile(join(cwd, "binary.bin"), Buffer.from([0x00, 0x01, 0x02]))

  return {
    ...fixture,
    runtimeInput: {
      ...fixture.runtimeInput,
      bridgeOptions: {
        ...(fixture.runtimeInput.bridgeOptions as Record<string, unknown>),
        runtimeParity: {
          ...((fixture.runtimeInput.bridgeOptions as { runtimeParity?: Record<string, unknown> }).runtimeParity ?? {}),
          cwd,
        },
      },
    },
  }
}

describe("Phase 3C attachment fixtures", () => {
  it.each(equivalentFixtures)("round-trips bridge-generated attachment fixture $scenario.name", async (fixture) => {
    expect(fixture.unsupported).toContain(unsupportedText)
    const runtimeFixture = await withFixtureWorkspace(fixture)
    const result = await compareBridgeToFixtureWithRuntime(runtimeFixture.runtimeInput, runtimeFixture, {
      bridgeOptions: runtimeFixture.runtimeInput.bridgeOptions as never,
    })

    expect(result.runtimeContext.gaps).toEqual([])
    expect(result.gate.equivalent).toBe(true)
  })

  it.each(gapFixtures)("keeps attachment gap fixture non-equivalent $scenario.name", async (fixture) => {
    expect(fixture.unsupported).toContain(unsupportedText)
    const runtimeFixture = await withFixtureWorkspace(fixture)
    const result = await compareBridgeToFixtureWithRuntime(runtimeFixture.runtimeInput, runtimeFixture, {
      bridgeOptions: runtimeFixture.runtimeInput.bridgeOptions as never,
    })

    expect(result.runtimeContext.gaps.map((gap) => gap.domain)).toContain("AttachmentDomain")
    expect(result.gate.equivalent).toBe(false)
  })
})
