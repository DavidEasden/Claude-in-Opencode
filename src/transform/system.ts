import { CLAUDE_CODE_SYSTEM } from "../claude-code/template"
import type { AnthropicTextBlock } from "../types"

interface SystemOptions {
  includeBillingHeader: boolean
  rewriteSystemIdentity: boolean
  systemPrompt?: string
  appendSystemPrompt?: string
}

export function transformSystem(_system: unknown, options: SystemOptions): AnthropicTextBlock[] {
  // strict emulation 默认返回 captured Claude Code system；配置项只调整第三个 agent/skills system block。
  const system = structuredClone(CLAUDE_CODE_SYSTEM) as unknown as AnthropicTextBlock[]
  const agentSystemBlock = system[2]
  if (!agentSystemBlock) return system

  if (typeof options.systemPrompt === "string") {
    agentSystemBlock.text = options.systemPrompt
  }
  if (typeof options.appendSystemPrompt === "string") {
    agentSystemBlock.text = `${agentSystemBlock.text}\n\n${options.appendSystemPrompt}`
  }

  return system
}
