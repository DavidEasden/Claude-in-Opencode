export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export type ParityVersion = "2.1.83-source" | "2.1.205-capture"
export type UrlKind = "anthropic-messages" | "other"

export interface ParityRequestSnapshot {
  method: "POST"
  urlKind: UrlKind
  headers: Record<string, string>
  body: JsonObject
}

export interface ParityScenario {
  name: string
  description: string
}

export interface ParityFixture {
  version: ParityVersion
  scenario: ParityScenario
  runtimeInput: JsonObject
  expected: ParityRequestSnapshot
  redactions: string[]
  unsupported?: string[]
}

export interface RedactionMap {
  projectRoot?: string
  home?: string
  sessionId?: string
  deviceId?: string
  accountUuid?: string
}

export interface ParityDiff {
  path: string
  kind: "missing" | "extra" | "changed"
  expected?: JsonValue
  actual?: JsonValue
}

export interface ParityDiffResult {
  equal: boolean
  diffs: ParityDiff[]
}
