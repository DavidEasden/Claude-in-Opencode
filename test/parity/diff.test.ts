import { describe, expect, it } from "vitest"
import { diffJson, formatDiffResult } from "../../src/parity/diff"

describe("parity diff", () => {
  it("reports missing, extra, and changed values with stable paths", () => {
    const result = diffJson(
      { body: { model: "claude", messages: [{ role: "user" }] } },
      { body: { model: "other", messages: [], tools: [] } },
    )

    expect(result.equal).toBe(false)
    expect(result.diffs).toEqual([
      { path: "body.messages[0]", kind: "missing", expected: { role: "user" } },
      { path: "body.model", kind: "changed", expected: "claude", actual: "other" },
      { path: "body.tools", kind: "extra", actual: [] },
    ])
    expect(formatDiffResult(result)).toContain("body.model changed")
  })

  it("returns equal when structures match", () => {
    expect(diffJson({ a: [1] }, { a: [1] })).toEqual({ equal: true, diffs: [] })
  })
})
