import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { doctorConfig } from "../src/cli/doctor"
import { applyUninstallConfig, uninstallConfig } from "../src/cli/uninstall"

function tempConfigPath(): string {
  return join(mkdtempSync(join(tmpdir(), "claude-in-opencode-")), "opencode.json")
}

describe("doctorConfig", () => {
  it("reports configured plugin", () => {
    expect(doctorConfig({ plugin: [["claude-in-opencode", { mode: "fetch" }]] })).toEqual({
      hasPlugin: true,
      hasAnthropicKey: false,
      problems: ["provider.anthropic.options.apiKey is not configured"],
    })
  })

  it("reports missing anthropic key when provider is an array", () => {
    const result = doctorConfig({ provider: [] })

    expect(result.hasAnthropicKey).toBe(false)
    expect(result.problems).toContain("provider.anthropic.options.apiKey is not configured")
  })

  it("reports missing anthropic key when anthropic provider is an array", () => {
    const result = doctorConfig({ provider: { anthropic: [] } })

    expect(result.hasAnthropicKey).toBe(false)
    expect(result.problems).toContain("provider.anthropic.options.apiKey is not configured")
  })

  it("reports missing anthropic key when anthropic options is an array", () => {
    const result = doctorConfig({ provider: { anthropic: { options: [] } } })

    expect(result.hasAnthropicKey).toBe(false)
    expect(result.problems).toContain("provider.anthropic.options.apiKey is not configured")
  })

  it("does not recognize the old package name", () => {
    expect(
      doctorConfig({
        plugin: [["opencode-claude-bridge", { mode: "fetch" }]],
        provider: { anthropic: { options: { apiKey: "test" } } },
      }),
    ).toEqual({
      hasPlugin: false,
      hasAnthropicKey: true,
      problems: ["plugin does not include claude-in-opencode"],
    })
  })
})

describe("applyUninstallConfig", () => {
  it("removes bridge plugin", () => {
    const result = applyUninstallConfig({
      plugin: [["claude-in-opencode", { mode: "fetch" }], "other-plugin"],
    })

    expect(result.plugin).toEqual(["other-plugin"])
  })

  it("does not remove the old package name", () => {
    const oldEntry = ["opencode-claude-bridge", { mode: "fetch" }]
    const result = applyUninstallConfig({ plugin: [oldEntry, "other-plugin"] })

    expect(result.plugin).toEqual([oldEntry, "other-plugin"])
  })
})

describe("uninstallConfig", () => {
  it("throws for invalid JSONC and leaves file unchanged", () => {
    const path = tempConfigPath()
    const original = '{"plugin":['
    writeFileSync(path, original)

    expect(() => uninstallConfig(path)).toThrow()
    expect(readFileSync(path, "utf8")).toBe(original)
  })

  it("throws for top-level arrays and leaves file unchanged", () => {
    const path = tempConfigPath()
    const original = "[]"
    writeFileSync(path, original)

    expect(() => uninstallConfig(path)).toThrow()
    expect(readFileSync(path, "utf8")).toBe(original)
  })
})
