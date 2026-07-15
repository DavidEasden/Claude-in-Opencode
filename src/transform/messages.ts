import { CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE, CLAUDE_CODE_USER_CONTEXT_BLOCK } from "../claude-code/template"
import { claudeCodeToolName } from "./tool-names"

type JsonRecord = Record<string, unknown>
type Message = { role: string; content: unknown }

interface MessagesOptions {
  userContextBlock?: string
  claudeMd?: string
  currentDate?: string
  includeDefaultToolsMessage?: boolean
  insertedMessages?: Array<{ role: "system"; content: string }>
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isMessage(value: unknown): value is Message {
  return isRecord(value) && typeof value.role === "string"
}

function contentBlocks(content: unknown): JsonRecord[] {
  if (typeof content === "string") return [{ type: "text", text: content }]
  if (!Array.isArray(content)) return []
  return content.filter(isRecord).filter((block) => !isOpenCodeInjectedContextBlock(block))
}

function isClaudeCodeContextBlock(block: JsonRecord): boolean {
  return block.type === "text" && block.text === CLAUDE_CODE_USER_CONTEXT_BLOCK.text
}

function createUserContextBlock(options: MessagesOptions): JsonRecord {
  if (typeof options.userContextBlock === "string") return { type: "text", text: options.userContextBlock }
  const baseText =
    typeof options.currentDate === "string"
      ? CLAUDE_CODE_USER_CONTEXT_BLOCK.text.replace(/Today's date is .*\./, `Today's date is ${options.currentDate}.`)
      : CLAUDE_CODE_USER_CONTEXT_BLOCK.text
  if (!options.claudeMd && typeof options.currentDate !== "string") return structuredClone(CLAUDE_CODE_USER_CONTEXT_BLOCK)
  return { type: "text", text: appendClaudeMd(baseText, options.claudeMd) }
}

function appendClaudeMd(text: string, claudeMd?: string): string {
  if (!claudeMd) return text
  const section = `\n\n# claudeMd\n${claudeMd}`
  if (text.includes("</system-reminder>")) return text.replace("</system-reminder>", `${section}\n</system-reminder>`)
  return `${text}${section}`
}

function isOpenCodeInjectedContextBlock(block: JsonRecord): boolean {
  return block.type === "text" && typeof block.text === "string" && block.text.startsWith("<EXTREMELY_IMPORTANT>\nYou have superpowers.")
}

function hasDeferredToolsMessage(messages: unknown[]): boolean {
  return messages.some(
    (message) =>
      isRecord(message) &&
      message.role === CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE.role &&
      message.content === CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE.content,
  )
}

function lastUserMessageIndex(messages: Message[]): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === "user") return index
  }
  return -1
}

function transformTextBlock(block: JsonRecord, ephemeral: boolean): JsonRecord {
  const text = typeof block.text === "string" ? block.text : ""
  if (!ephemeral) return { type: "text", text }
  return { type: "text", text, cache_control: { type: "ephemeral" } }
}

function transformToolUseBlock(block: JsonRecord): JsonRecord {
  return {
    type: "tool_use",
    id: block.id,
    name: typeof block.name === "string" ? claudeCodeToolName(block.name) : block.name,
    input: isRecord(block.input) ? structuredClone(block.input) : {},
  }
}

function transformToolResultBlock(block: JsonRecord): JsonRecord {
  const result: JsonRecord = {
    type: "tool_result",
    tool_use_id: block.tool_use_id,
    content: block.content,
    cache_control: { type: "ephemeral" },
  }
  if (typeof block.is_error === "boolean") result.is_error = block.is_error
  return result
}

function transformBlock(block: JsonRecord, options: { latestUserText: boolean }): JsonRecord {
  if (block.type === "text") return transformTextBlock(block, options.latestUserText)
  if (block.type === "tool_use") return transformToolUseBlock(block)
  if (block.type === "tool_result") return transformToolResultBlock(block)
  return structuredClone(block)
}

function transformMessage(
  message: Message,
  options: { firstUser: boolean; latestUser: boolean; userContextBlock: JsonRecord },
): Message {
  const blocks = contentBlocks(message.content)
  const transformed = blocks.map((block, index) =>
    transformBlock(block, {
      latestUserText: options.latestUser && block.type === "text" && index === blocks.length - 1,
    }),
  )

  const content =
    options.firstUser && !transformed.some(isClaudeCodeContextBlock)
      ? [structuredClone(options.userContextBlock), ...transformed]
      : transformed

  return { role: message.role, content }
}

export function transformMessages(messages: unknown, options: MessagesOptions = {}): unknown {
  if (!Array.isArray(messages)) return messages

  if (hasDeferredToolsMessage(messages)) return structuredClone(messages)

  const chronological = messages.filter(isMessage)
  const latestUser = lastUserMessageIndex(chronological)
  let firstUserSeen = false
  const userContextBlock = createUserContextBlock(options)
  const transformed = chronological.map((message, index) => {
    const firstUser = message.role === "user" && !firstUserSeen
    if (firstUser) firstUserSeen = true
    return transformMessage(message, { firstUser, latestUser: index === latestUser, userContextBlock })
  })

  const includeDefaultToolsMessage = options.includeDefaultToolsMessage ?? true
  const insertedMessages = options.insertedMessages ?? []
  return structuredClone(
    includeDefaultToolsMessage
      ? [...transformed, ...insertedMessages, CLAUDE_CODE_DEFERRED_TOOLS_MESSAGE]
      : [...transformed, ...insertedMessages],
  )
}
