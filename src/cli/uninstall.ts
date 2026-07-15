import { readFileSync, writeFileSync } from "node:fs"
import { defaultGlobalConfigPath, parseConfigText, type JsonRecord } from "./init"

function isBridgePlugin(value: unknown): boolean {
  return value === "claude-in-opencode" || (Array.isArray(value) && value[0] === "claude-in-opencode")
}

export function applyUninstallConfig(input: JsonRecord): JsonRecord {
  if (!Array.isArray(input.plugin)) return input
  return {
    ...input,
    plugin: input.plugin.filter((item) => !isBridgePlugin(item)),
  }
}

export function uninstallConfig(path = defaultGlobalConfigPath()): void {
  const current = parseConfigText(readFileSync(path, "utf8"), path)
  const next = applyUninstallConfig(current)
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`)
}
