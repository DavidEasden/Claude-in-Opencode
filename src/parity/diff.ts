import type { JsonValue, ParityDiff, ParityDiffResult } from "./types"

function isRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function childPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key
}

function arrayPath(path: string, index: number): string {
  return `${path}[${index}]`
}

function compare(expected: JsonValue | undefined, actual: JsonValue | undefined, path: string, diffs: ParityDiff[]): void {
  if (expected === undefined) {
    diffs.push({ path, kind: "extra", actual })
    return
  }
  if (actual === undefined) {
    diffs.push({ path, kind: "missing", expected })
    return
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const max = Math.max(expected.length, actual.length)
    for (let index = 0; index < max; index += 1) compare(expected[index], actual[index], arrayPath(path, index), diffs)
    return
  }
  if (isRecord(expected) && isRecord(actual)) {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()
    for (const key of keys) compare(expected[key], actual[key], childPath(path, key), diffs)
    return
  }
  if (JSON.stringify(expected) !== JSON.stringify(actual)) diffs.push({ path, kind: "changed", expected, actual })
}

export function diffJson(expected: JsonValue, actual: JsonValue): ParityDiffResult {
  const diffs: ParityDiff[] = []
  compare(expected, actual, "", diffs)
  return { equal: diffs.length === 0, diffs }
}

export function formatDiffResult(result: ParityDiffResult): string {
  if (result.equal) return "No parity differences."
  return result.diffs
    .map((diff) => `${diff.path} ${diff.kind}: expected=${JSON.stringify(diff.expected)} actual=${JSON.stringify(diff.actual)}`)
    .join("\n")
}
