import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { homedir } from "node:os"
import { parse, type ParseError } from "jsonc-parser"

export type JsonRecord = Record<string, unknown>

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseConfigText(text: string, path: string): JsonRecord {
  const errors: ParseError[] = []
  const parsed = parse(text, errors)
  if (errors.length > 0) {
    throw new Error(`Failed to parse JSONC config at ${path}`)
  }
  if (!isJsonRecord(parsed)) {
    throw new Error(`Config at ${path} must be a JSON object`)
  }
  return parsed
}

function isPluginEntry(value: unknown): boolean {
  if (value === "claude-in-opencode") return true
  return Array.isArray(value) && value[0] === "claude-in-opencode"
}

export function defaultGlobalConfigPath(): string {
  return join(homedir(), ".config", "opencode", "opencode.json")
}

export function applyInitConfig(input: JsonRecord): JsonRecord {
  const plugin = Array.isArray(input.plugin) ? input.plugin.filter((item) => !isPluginEntry(item)) : []
  const provider = isJsonRecord(input.provider) ? input.provider : {}
  const anthropic = isJsonRecord(provider.anthropic) ? provider.anthropic : {}
  const options = isJsonRecord(anthropic.options) ? anthropic.options : {}

  return {
    ...input,
    $schema: typeof input.$schema === "string" ? input.$schema : "https://opencode.ai/config.json",
    plugin: [...plugin, ["claude-in-opencode", { mode: "fetch" }]],
    model: typeof input.model === "string" ? input.model : "anthropic/claude-opus-4-8",
    provider: {
      ...provider,
      anthropic: {
        ...anthropic,
        options: {
          ...options,
          apiKey: typeof options.apiKey === "string" ? options.apiKey : "{env:ANTHROPIC_API_KEY}",
        },
      },
    },
  }
}

export function initConfig(path = defaultGlobalConfigPath()): void {
  let current: JsonRecord = {}
  try {
    current = parseConfigText(readFileSync(path, "utf8"), path)
  } catch (error) {
    if (isJsonRecord(error) && error.code === "ENOENT") {
      current = {}
    } else {
      throw error
    }
  }

  const next = applyInitConfig(current)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`)
}
