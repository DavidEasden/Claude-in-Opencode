import type { ResolvedBridgeOptions } from "../types"

export const SOURCE_COMPATIBLE_CLI_VERSION = "2.1.205"
export const SOURCE_COMPATIBLE_SDK_VERSION = "0.94.0"

export function isSourceCompatibleProfile(options: ResolvedBridgeOptions): boolean {
  return options.runtimeParity.enabled && options.runtimeParity.profile === "source-compatible"
}
