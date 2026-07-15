import { describe, expect, it } from "vitest"
import plugin from "../src/plugin"

describe("plugin", () => {
  it("injects fetch into anthropic provider options without setting localhost baseURL", async () => {
    const hooks = await plugin({}, {})
    const cfg: any = {
      provider: {
        anthropic: {
          options: {
            apiKey: "test-key",
          },
        },
      },
    }

    hooks.config?.(cfg)

    expect(typeof cfg.provider.anthropic.options.fetch).toBe("function")
    expect(cfg.provider.anthropic.options.baseURL).toBeUndefined()
  })
})
