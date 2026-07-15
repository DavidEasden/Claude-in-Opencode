import { describe, expect, it } from "vitest"
import fixture from "../fixtures/parity/2.1.205-capture/single-turn.json"
import type { ParityFixture } from "../../src/parity/types"

describe("parity fixture schema", () => {
  it("loads the seed fixture with required top-level fields", () => {
    const sample = fixture as ParityFixture

    expect(sample.version).toBe("2.1.205-capture")
    expect(sample.scenario.name).toBe("single-turn")
    expect(sample.expected.method).toBe("POST")
    expect(sample.expected.urlKind).toBe("anthropic-messages")
    expect(sample.expected.body).toHaveProperty("model")
    expect(sample.redactions).toContain("headers.x-api-key")
  })
})
