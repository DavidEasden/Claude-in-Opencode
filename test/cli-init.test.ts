import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { applyInitConfig, initConfig } from "../src/cli/init"

describe("applyInitConfig", () => {
  it("adds plugin and anthropic api key env reference", () => {
    const result = applyInitConfig({})

    expect(result.plugin).toEqual([["claude-in-opencode", { mode: "fetch" }]])
    expect(result.provider).toEqual({
      anthropic: {
        options: {
          apiKey: "{env:ANTHROPIC_API_KEY}",
        },
      },
    })
  })

  it("does not add duplicate plugin entries", () => {
    const result = applyInitConfig({ plugin: [["claude-in-opencode", { mode: "fetch" }]] })

    expect(result.plugin).toHaveLength(1)
  })

  it("does not treat the old package name as the current plugin", () => {
    const oldEntry = ["opencode-claude-bridge", { mode: "fetch" }]
    const result = applyInitConfig({ plugin: [oldEntry] })

    expect(result.plugin).toEqual([oldEntry, ["claude-in-opencode", { mode: "fetch" }]])
  })

  it("treats array provider values as empty provider records", () => {
    const expectedProvider = {
      anthropic: {
        options: {
          apiKey: "{env:ANTHROPIC_API_KEY}",
        },
      },
    }

    expect(applyInitConfig({ provider: [] }).provider).toEqual(expectedProvider)
    expect(applyInitConfig({ provider: ["unexpected"] }).provider).toEqual(expectedProvider)
  })

  it("treats nested array config sections as empty records", () => {
    expect(applyInitConfig({ provider: { anthropic: ["unexpected"] } }).provider).toEqual({
      anthropic: {
        options: {
          apiKey: "{env:ANTHROPIC_API_KEY}",
        },
      },
    })

    expect(applyInitConfig({ provider: { anthropic: { options: ["unexpected"] } } }).provider).toEqual({
      anthropic: {
        options: {
          apiKey: "{env:ANTHROPIC_API_KEY}",
        },
      },
    })
  })
})

describe("initConfig", () => {
  it("throws and preserves an existing invalid JSONC config", () => {
    const path = join(mkdtempSync(join(tmpdir(), "claude-bridge-init-")), "opencode.json")
    const original = '{"plugin":['
    writeFileSync(path, original)

    expect(() => initConfig(path)).toThrow()
    expect(readFileSync(path, "utf8")).toBe(original)
  })

  it("throws and preserves an existing non-object JSON config", () => {
    const path = join(mkdtempSync(join(tmpdir(), "claude-bridge-init-")), "opencode.json")
    const original = "[]"
    writeFileSync(path, original)

    expect(() => initConfig(path)).toThrow()
    expect(readFileSync(path, "utf8")).toBe(original)
  })
})
