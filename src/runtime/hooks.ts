import type { ResolvedBridgeOptions } from "../types"

type RuntimeSystemMessage = { role: "system"; content: string }

export function runtimeSystemMessages(options: ResolvedBridgeOptions): RuntimeSystemMessage[] {
  const runtime = options.runtimeParity
  if (!runtime.enabled) return []

  const messages: RuntimeSystemMessage[] = []
  if (runtime.simulateHooks) {
    messages.push(...runtime.hookSystemMessages.map((content) => ({ role: "system" as const, content })))
  }
  if (runtime.simulatePermissions) {
    messages.push(...runtime.permissionSystemMessages.map((content) => ({ role: "system" as const, content })))
  }
  return messages
}
