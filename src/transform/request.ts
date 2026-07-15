import {
  CLAUDE_CODE_CONTEXT_MANAGEMENT,
  CLAUDE_CODE_MAX_TOKENS,
  CLAUDE_CODE_MODEL,
  CLAUDE_CODE_OUTPUT_CONFIG,
  CLAUDE_CODE_STREAM,
  CLAUDE_CODE_THINKING,
} from "../claude-code/template"
import { computeBillingHeaderText } from "../profile/billing"
import { isSourceCompatibleProfile, SOURCE_COMPATIBLE_CLI_VERSION } from "../profile/claude-code-profile"
import { cleanupAnthropicRequest } from "../profile/cleanup"
import { applyClaudeCodeMetadata } from "./metadata"
import { transformMessages } from "./messages"
import { transformSystem } from "./system"
import { transformTools, usesDefaultToolSet } from "./tools"
import type { AnthropicRequestBody, JsonObject, TransformContext } from "../types"

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function firstUserText(messages: unknown): string {
  if (!Array.isArray(messages)) return ""
  const firstUser = messages.find((message) => isRecord(message) && message.role === "user")
  if (!isRecord(firstUser)) return ""
  if (typeof firstUser.content === "string") return firstUser.content
  if (!Array.isArray(firstUser.content)) return ""
  const firstTextBlock = firstUser.content.find(
    (block) => isRecord(block) && block.type === "text" && typeof block.text === "string",
  )
  return isRecord(firstTextBlock) && typeof firstTextBlock.text === "string" ? firstTextBlock.text : ""
}

function isBillingHeaderBlock(block: unknown): boolean {
  return (
    isRecord(block) &&
    block.type === "text" &&
    typeof block.text === "string" &&
    block.text.trim().toLowerCase().startsWith("x-anthropic-billing-header:")
  )
}

export function transformRequestBody(input: unknown, context: TransformContext): AnthropicRequestBody {
  if (!isRecord(input)) return input as AnthropicRequestBody

  const sourceCompatible = isSourceCompatibleProfile(context.options)
  const normalizedInput = sourceCompatible
    ? cleanupAnthropicRequest(input, { strictSystem: context.options.runtimeParity.strictSystem })
    : input
  if (!isRecord(normalizedInput)) return input as AnthropicRequestBody

  const includeDefaultToolsMessage = usesDefaultToolSet(context.options)

  const body: AnthropicRequestBody = {
    model: CLAUDE_CODE_MODEL,
    max_tokens: CLAUDE_CODE_MAX_TOKENS,
    thinking: structuredClone(CLAUDE_CODE_THINKING),
    output_config: { ...structuredClone(CLAUDE_CODE_OUTPUT_CONFIG), effort: context.options.effort },
    context_management: structuredClone(CLAUDE_CODE_CONTEXT_MANAGEMENT),
    system: transformSystem(normalizedInput.system, {
      includeBillingHeader: context.options.includeBillingHeader,
      rewriteSystemIdentity: context.options.rewriteSystemIdentity,
      systemPrompt: context.options.systemPrompt,
      appendSystemPrompt: context.options.appendSystemPrompt,
    }),
    messages: transformMessages(normalizedInput.messages, {
      userContextBlock: context.options.userContextBlock,
      claudeMd: context.runtimeContext?.claudeMd,
      currentDate: context.options.currentDate,
      includeDefaultToolsMessage,
      insertedMessages: context.runtimeContext?.insertedMessages,
    }),
    // strict emulation 默认发送 Claude Code 捕获到的工具定义，显式配置时只发送配置子集。
    tools: transformTools(normalizedInput.tools, context.options, context.runtimeContext?.mirroredMcpTools),
    stream: CLAUDE_CODE_STREAM,
  }

  if (sourceCompatible && Array.isArray(body.system)) {
    body.system = [
      {
        type: "text",
        text: computeBillingHeaderText({
          firstUserText: firstUserText(normalizedInput.messages),
          cliVersion: SOURCE_COMPATIBLE_CLI_VERSION,
        }),
      },
      ...body.system.filter((block) => !isBillingHeaderBlock(block)),
    ]
  }

  return applyClaudeCodeMetadata(body, { sessionID: context.sessionID, options: context.options })
}
