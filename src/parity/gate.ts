import type { RuntimeParityContext, RuntimeParityGateResult, RuntimeParityProfile } from "../runtime/types"
import type { ParityDiffResult, ParityVersion } from "./types"

interface RuntimeParityGateInputs {
  fixtureVersion: ParityVersion
  runtimeProfile: RuntimeParityProfile
}

const captureProfile = "2.1.205-capture"

export function evaluateRuntimeParity(
  diff: ParityDiffResult,
  context: RuntimeParityContext,
  inputs: RuntimeParityGateInputs,
): RuntimeParityGateResult {
  const reasons: string[] = []
  if (inputs.fixtureVersion !== captureProfile) {
    reasons.push(`fixture profile version must be ${captureProfile} (received ${inputs.fixtureVersion})`)
  }
  if (inputs.runtimeProfile !== captureProfile) {
    reasons.push(`runtime profile must be ${captureProfile} (received ${inputs.runtimeProfile})`)
  }
  if (diff.diffs.length > 0) reasons.push(`normalized request diff has ${diff.diffs.length} difference(s)`)
  if (context.gaps.length > 0) reasons.push(`runtime context has ${context.gaps.length} gap(s)`)

  return {
    equivalent: reasons.length === 0,
    diffCount: diff.diffs.length,
    gapCount: context.gaps.length,
    reasons,
  }
}
