import type { RuntimeParityGateResult } from "./types"
import type { RuntimeStateEvidence, UnsupportedRuntimeGap } from "./domain"

export function formatRuntimeGaps(gaps: UnsupportedRuntimeGap[]): string {
  if (gaps.length === 0) return "No runtime parity gaps."
  return [
    "Parity gaps:",
    ...gaps.map((gap) => `- ${gap.domain}: ${gap.reason}${gap.path ? ` (${gap.path})` : ""}`),
  ].join("\n")
}

export function formatRuntimeStateEvidence(stateUsed: RuntimeStateEvidence[]): string {
  if (stateUsed.length === 0) return "No runtime state evidence."
  return [
    "Runtime state used:",
    ...stateUsed.map((state) => `- ${state.domain}: ${state.source}${state.detail ? ` - ${state.detail}` : ""}`),
  ].join("\n")
}

export function formatRuntimeParityGate(result: RuntimeParityGateResult): string {
  if (result.equivalent) return "Runtime parity gate: equivalent."
  return ["Runtime parity gate: not equivalent.", ...result.reasons.map((reason) => `- ${reason}`)].join("\n")
}
