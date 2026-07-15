import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { readParityFixture, sanitizeFixture, writeParityFixture } from "../../src/parity/fixtures"
import type { ParityFixture } from "../../src/parity/types"

const fixture: ParityFixture = {
  version: "2.1.205-capture",
  scenario: { name: "sanitize", description: "sanitize test" },
  runtimeInput: {},
  expected: {
    method: "POST",
    urlKind: "anthropic-messages",
    headers: { "x-api-key": "sk-ant-secret" },
    body: { metadata: { user_id: JSON.stringify({ device_id: "dev-1" }) } },
  },
  redactions: [],
}

describe("parity fixtures", () => {
  it("sanitizes and writes fixtures as stable pretty JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bridge-parity-fixture-"))
    const path = join(dir, "fixture.json")
    const sanitized = sanitizeFixture(fixture, { deviceId: "dev-1" })

    await writeParityFixture(path, sanitized)

    expect(await readParityFixture(path)).toEqual(sanitized)
    expect(await readFile(path, "utf8")).toContain("\n  \"version\"")
    expect(JSON.stringify(sanitized)).not.toContain("sk-ant-secret")
    expect(JSON.stringify(sanitized)).not.toContain("dev-1")
  })

  it("sanitizes fixtures before writing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bridge-parity-fixture-"))
    const path = join(dir, "fixture.json")

    await writeParityFixture(path, fixture)

    const written = await readFile(path, "utf8")
    expect(written).not.toContain("sk-ant-secret")
    expect(written).not.toContain("dev-1")
  })

  it("sanitizes non-expected fixture fields before writing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bridge-parity-fixture-"))
    const path = join(dir, "fixture.json")
    const unsafeFixture: ParityFixture = {
      ...fixture,
      scenario: { name: "sanitize", description: "uses sk-ant-runtime from /Users/david/project" },
      runtimeInput: {
        apiKey: "sk-ant-runtime",
        cwd: "/Users/david/project",
        metadata: {
          session_id: "ses_runtime",
          device_id: "dev-runtime",
          account_uuid: "acc-runtime",
        },
      },
      unsupported: ["user_id user-runtime on /Users/david/project"],
    }

    await writeParityFixture(path, unsafeFixture, { projectRoot: "/Users/david/project" })

    const written = await readFile(path, "utf8")
    expect(written).not.toContain("sk-ant-runtime")
    expect(written).not.toContain("/Users/david/project")
    expect(written).not.toContain("ses_runtime")
    expect(written).not.toContain("dev-runtime")
    expect(written).not.toContain("acc-runtime")
    expect(written).toContain("$API_KEY_REDACTED")
    expect(written).toContain("$PROJECT_ROOT")
    expect(written).toContain("$SESSION_ID")
    expect(written).toContain("$DEVICE_ID")
    expect(written).toContain("$ACCOUNT_UUID")
  })
})
