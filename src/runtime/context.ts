import type { ResolvedBridgeOptions } from "../types"
import { resolveRuntimeDomains } from "./resolver"
import type { RuntimeParityContext, RuntimeParityState } from "./types"

interface RuntimeContextParams {
  options: ResolvedBridgeOptions
  sessionID?: string
  state: RuntimeParityState
}

export async function createRuntimeParityContext(
  input: unknown,
  params: RuntimeContextParams,
): Promise<RuntimeParityContext> {
  return resolveRuntimeDomains(input, params)
}
