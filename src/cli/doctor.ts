import { isJsonRecord, type JsonRecord } from "./init"

function hasPlugin(input: JsonRecord): boolean {
  if (!Array.isArray(input.plugin)) return false
  return input.plugin.some((item) => item === "claude-in-opencode" || (Array.isArray(item) && item[0] === "claude-in-opencode"))
}

function hasAnthropicKey(input: JsonRecord): boolean {
  const provider = input.provider
  if (!isJsonRecord(provider)) return false
  const anthropic = provider.anthropic
  if (!isJsonRecord(anthropic)) return false
  const options = anthropic.options
  if (!isJsonRecord(options)) return false
  return typeof options.apiKey === "string" && options.apiKey.length > 0
}

export function doctorConfig(input: JsonRecord) {
  const problems: string[] = []
  const pluginConfigured = hasPlugin(input)
  const anthropicKeyConfigured = hasAnthropicKey(input)

  if (!pluginConfigured) problems.push("plugin does not include claude-in-opencode")
  if (!anthropicKeyConfigured) problems.push("provider.anthropic.options.apiKey is not configured")

  return {
    hasPlugin: pluginConfigured,
    hasAnthropicKey: anthropicKeyConfigured,
    problems,
  }
}
