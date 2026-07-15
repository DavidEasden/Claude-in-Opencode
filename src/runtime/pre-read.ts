import type { ResolvedBridgeOptions } from "../types"

type RuntimeSystemMessage = { role: "system"; content: string }

export function preReadSystemMessages(options: ResolvedBridgeOptions): RuntimeSystemMessage[] {
  const runtime = options.runtimeParity
  if (!runtime.enabled || !runtime.preReadFiles) return []
  return runtime.preReadMessages.map((content) => ({ role: "system" as const, content }))
}
