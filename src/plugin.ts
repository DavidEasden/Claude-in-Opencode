import { resolveBridgeOptions } from "./config"
import { createBridgeFetch } from "./fetch"
import type { BridgeOptions } from "./types"

type ConfigShape = {
  provider?: Record<string, { options?: Record<string, unknown> }>
}

export default async function claudeBridgePlugin(_input: unknown, options?: BridgeOptions) {
  const resolved = resolveBridgeOptions(options)

  return {
    config(cfg: ConfigShape) {
      cfg.provider ??= {}
      cfg.provider.anthropic ??= {}
      cfg.provider.anthropic.options ??= {}

      const originalFetch = cfg.provider.anthropic.options.fetch
      const upstreamFetch = typeof originalFetch === "function" ? (originalFetch as typeof fetch) : globalThis.fetch

      cfg.provider.anthropic.options.fetch = createBridgeFetch({
        options: resolved,
        upstreamFetch,
      })
    },
  }
}
