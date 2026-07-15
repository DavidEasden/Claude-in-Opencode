import { resolveBridgeOptions } from "../config"
import { createRuntimeParityContext } from "../runtime/context"
import { createRuntimeParityState } from "../runtime/state"
import type { RuntimeParityContext, RuntimeParityGateResult } from "../runtime/types"
import { transformRequestBody } from "../transform/request"
import { diffJson } from "./diff"
import { evaluateRuntimeParity } from "./gate"
import { normalizeSnapshot } from "./normalize"
import type { BridgeOptions } from "../types"
import type { JsonValue, ParityDiffResult, ParityFixture, ParityRequestSnapshot, RedactionMap } from "./types"

interface BridgeSnapshotOptions {
  bridgeOptions?: BridgeOptions
  sessionID?: string
  headers?: Record<string, string>
  redactions?: RedactionMap
}

export interface BridgeFixtureComparison {
  expected: ParityRequestSnapshot
  actual: ParityRequestSnapshot
  diff: ParityDiffResult
}

export interface BridgeRuntimeFixtureComparison extends BridgeFixtureComparison {
  runtimeContext: RuntimeParityContext
  gate: RuntimeParityGateResult
}

export function buildBridgeSnapshot(input: unknown, options: BridgeSnapshotOptions = {}): ParityRequestSnapshot {
  const body = transformRequestBody(input, {
    requestURL: "https://api.anthropic.com/v1/messages",
    sessionID: options.sessionID,
    options: resolveBridgeOptions(options.bridgeOptions ?? {}),
  })

  return {
    method: "POST",
    urlKind: "anthropic-messages",
    headers: options.headers ?? {},
    body: body as ParityRequestSnapshot["body"],
  }
}

export function compareBridgeToFixture(
  input: unknown,
  fixture: ParityFixture,
  options: BridgeSnapshotOptions = {},
): BridgeFixtureComparison {
  const redactions = options.redactions ?? {}
  const expected = normalizeSnapshot(fixture.expected, redactions)
  const actual = normalizeSnapshot(buildBridgeSnapshot(input, options), redactions)

  return { expected, actual, diff: diffJson(expected as unknown as JsonValue, actual as unknown as JsonValue) }
}

export async function compareBridgeToFixtureWithRuntime(
  input: unknown,
  fixture: ParityFixture,
  options: BridgeSnapshotOptions = {},
): Promise<BridgeRuntimeFixtureComparison> {
  const redactions = options.redactions ?? {}
  const bridgeOptions = resolveBridgeOptions(options.bridgeOptions ?? {})
  const runtimeContext = await createRuntimeParityContext(input, {
    options: bridgeOptions,
    sessionID: options.sessionID,
    state: createRuntimeParityState(),
  })
  const body = transformRequestBody(input, {
    requestURL: "https://api.anthropic.com/v1/messages",
    sessionID: options.sessionID,
    options: bridgeOptions,
    runtimeContext,
  })
  const expected = normalizeSnapshot(fixture.expected, redactions)
  const actual = normalizeSnapshot(
    {
      method: "POST",
      urlKind: "anthropic-messages",
      headers: options.headers ?? {},
      body: body as ParityRequestSnapshot["body"],
    },
    redactions,
  )
  const diff = diffJson(expected as unknown as JsonValue, actual as unknown as JsonValue)

  return {
    expected,
    actual,
    diff,
    runtimeContext,
    gate: evaluateRuntimeParity(diff, runtimeContext, {
      fixtureVersion: fixture.version,
      runtimeProfile: bridgeOptions.runtimeParity.profile,
    }),
  }
}
