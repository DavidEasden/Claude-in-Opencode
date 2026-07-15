type JsonRecord = Record<string, unknown>

interface CleanupOptions {
  strictSystem: boolean
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isBillingHeaderText(text: string): boolean {
  return text.trim().toLowerCase().startsWith("x-anthropic-billing-header:")
}

function cleanSystem(system: unknown): unknown {
  if (typeof system === "string") return isBillingHeaderText(system) ? undefined : system
  if (!Array.isArray(system)) return system
  const filtered = system.filter(
    (block) => !(isRecord(block) && block.type === "text" && typeof block.text === "string" && isBillingHeaderText(block.text)),
  )
  return filtered.length > 0 ? filtered : undefined
}

function cleanMessages(messages: unknown): unknown {
  if (!Array.isArray(messages)) return messages
  return messages.flatMap((message) => {
    if (!isRecord(message)) return []
    const content = message.content
    if (typeof content === "string") return content.trim() === "" ? [] : [message]
    if (!Array.isArray(content)) return [message]
    const kept = content.filter(
      (block) => !(isRecord(block) && block.type === "text" && typeof block.text === "string" && block.text.trim() === ""),
    )
    return kept.length === 0 ? [] : [{ ...message, content: kept }]
  })
}

export function cleanupAnthropicRequest(input: unknown, _options: CleanupOptions): unknown {
  if (!isRecord(input)) return input
  return {
    ...input,
    system: cleanSystem(input.system),
    messages: cleanMessages(input.messages),
  }
}
