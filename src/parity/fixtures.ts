import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { normalizeSnapshot } from "./normalize"
import { redactJson } from "./redact"
import type { JsonObject, ParityFixture, RedactionMap } from "./types"

const REQUIRED_REDACTIONS = ["headers.authorization", "headers.x-api-key"]

export async function readParityFixture(path: string): Promise<ParityFixture> {
  return JSON.parse(await readFile(path, "utf8")) as ParityFixture
}

export function sanitizeFixture(fixture: ParityFixture, redactions: RedactionMap = {}): ParityFixture {
  const redacted = redactJson(fixture as unknown as JsonObject, redactions) as unknown as ParityFixture
  return {
    ...redacted,
    expected: normalizeSnapshot(fixture.expected, redactions),
    redactions: [...new Set([...redacted.redactions, ...REQUIRED_REDACTIONS])].sort(),
  }
}

export async function writeParityFixture(path: string, fixture: ParityFixture, redactions: RedactionMap = {}): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(sanitizeFixture(fixture, redactions), null, 2)}\n`)
}
