import { describe, expect, it } from "vitest"
import { evaluateRuntimeParity } from "../../src/parity/gate"
import type { RuntimeParityContext } from "../../src/runtime/types"

const emptyContext: RuntimeParityContext = {
  insertedMessages: [],
  mirroredMcpTools: [],
  gaps: [],
  stateUsed: [],
}

describe("evaluateRuntimeParity", () => {
  it("passes only when diff and gaps are empty", () => {
    expect(
      evaluateRuntimeParity({ equal: true, diffs: [] }, emptyContext, {
        fixtureVersion: "2.1.205-capture",
        runtimeProfile: "2.1.205-capture",
      }),
    ).toEqual({
      equivalent: true,
      diffCount: 0,
      gapCount: 0,
      reasons: [],
    })
  })

  it("fails when normalized diff is not empty", () => {
    expect(
      evaluateRuntimeParity(
        { equal: false, diffs: [{ path: "body.model", kind: "changed", expected: "a", actual: "b" }] },
        emptyContext,
        { fixtureVersion: "2.1.205-capture", runtimeProfile: "2.1.205-capture" },
      ),
    ).toEqual({
      equivalent: false,
      diffCount: 1,
      gapCount: 0,
      reasons: ["normalized request diff has 1 difference(s)"],
    })
  })

  it("fails when normalized diff entries are present even if equal is true", () => {
    expect(
      evaluateRuntimeParity(
        { equal: true, diffs: [{ path: "body.model", kind: "changed", expected: "a", actual: "b" }] },
        emptyContext,
        { fixtureVersion: "2.1.205-capture", runtimeProfile: "2.1.205-capture" },
      ),
    ).toEqual({
      equivalent: false,
      diffCount: 1,
      gapCount: 0,
      reasons: ["normalized request diff has 1 difference(s)"],
    })
  })

  it("fails when runtime gaps are present", () => {
    expect(
      evaluateRuntimeParity(
        { equal: true, diffs: [] },
        {
          ...emptyContext,
          gaps: [{ domain: "AttachmentDomain", reason: "automatic @file reads require Phase 3C attachment resolver" }],
        },
        { fixtureVersion: "2.1.205-capture", runtimeProfile: "2.1.205-capture" },
      ),
    ).toEqual({
      equivalent: false,
      diffCount: 0,
      gapCount: 1,
      reasons: ["runtime context has 1 gap(s)"],
    })
  })

  it("fails when fixture version is not the capture target", () => {
    expect(
      evaluateRuntimeParity({ equal: true, diffs: [] }, emptyContext, {
        fixtureVersion: "2.1.83-source",
        runtimeProfile: "2.1.205-capture",
      }),
    ).toEqual({
      equivalent: false,
      diffCount: 0,
      gapCount: 0,
      reasons: ["fixture profile version must be 2.1.205-capture (received 2.1.83-source)"],
    })
  })

  it("fails when runtime profile is not the capture target", () => {
    expect(
      evaluateRuntimeParity({ equal: true, diffs: [] }, emptyContext, {
        fixtureVersion: "2.1.205-capture",
        runtimeProfile: "source-compatible",
      }),
    ).toEqual({
      equivalent: false,
      diffCount: 0,
      gapCount: 0,
      reasons: ["runtime profile must be 2.1.205-capture (received source-compatible)"],
    })
  })
})
