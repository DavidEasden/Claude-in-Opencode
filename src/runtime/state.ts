import type { RuntimeParityState } from "./types"

export function createRuntimeParityState(): RuntimeParityState {
  return {
    memoryByCwd: new Map(),
  }
}
