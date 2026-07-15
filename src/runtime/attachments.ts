import { extname } from "node:path"
import type { ResolvedBridgeOptions } from "../types"
import type { RuntimeStateEvidence, UnsupportedRuntimeGap } from "./domain"
import { readWorkspaceTextFile, resolveWorkspacePath } from "./workspace"

type JsonRecord = Record<string, unknown>

export interface AttachmentMention {
  raw: string
  path: string
  lineStart?: number
  lineEnd?: number
}

export interface AttachmentDomainResult {
  insertedMessages: Array<{ role: "system"; content: string }>
  stateUsed: RuntimeStateEvidence[]
  gaps: UnsupportedRuntimeGap[]
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function userTextBlocks(input: unknown): string[] {
  if (!isRecord(input) || !Array.isArray(input.messages)) return []
  const texts: string[] = []
  for (const message of input.messages) {
    if (!isRecord(message) || message.role !== "user") continue
    if (typeof message.content === "string") {
      texts.push(message.content)
      continue
    }
    if (!Array.isArray(message.content)) continue
    for (const block of message.content) {
      if (isRecord(block) && block.type === "text" && typeof block.text === "string") texts.push(block.text)
    }
  }
  return texts
}

function attachmentGap(reason: string, path?: string): UnsupportedRuntimeGap {
  return path ? { domain: "AttachmentDomain", reason, path } : { domain: "AttachmentDomain", reason }
}

function gapPath(raw: string): string {
  return raw.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(raw) || raw.startsWith("\\\\") ? "<absolute-path>" : raw
}

function validRange(lineStart?: number, lineEnd?: number): boolean {
  if (lineStart === undefined && lineEnd === undefined) return true
  if (lineStart === undefined || lineEnd === undefined) return false
  return Number.isInteger(lineStart) && Number.isInteger(lineEnd) && lineStart > 0 && lineEnd >= lineStart
}

function parseReference(raw: string): { mention?: AttachmentMention; gap?: UnsupportedRuntimeGap } {
  const hashMatch = raw.match(/^(.+?)#L(\d+)(?:-(\d+))?$/u)
  if (hashMatch) {
    const lineStart = Number(hashMatch[2])
    const lineEnd = hashMatch[3] ? Number(hashMatch[3]) : lineStart
    if (!validRange(lineStart, lineEnd)) return { gap: attachmentGap("invalid @file line range", gapPath(raw)) }
    return { mention: { raw, path: hashMatch[1] ?? raw, lineStart, lineEnd } }
  }

  const colonMatch = raw.match(/^(.+):(\d+)(?:-(\d+))?$/u)
  if (colonMatch) {
    const lineStart = Number(colonMatch[2])
    const lineEnd = colonMatch[3] ? Number(colonMatch[3]) : lineStart
    if (!validRange(lineStart, lineEnd)) return { gap: attachmentGap("invalid @file line range", gapPath(raw)) }
    return { mention: { raw, path: colonMatch[1] ?? raw, lineStart, lineEnd } }
  }

  if (/^.+#L/u.test(raw) || /^.+:\d+-/u.test(raw)) return { gap: attachmentGap("invalid @file line range", gapPath(raw)) }
  return { mention: { raw, path: raw } }
}

function pushMention(raw: string, seen: Set<string>, mentions: AttachmentMention[], gaps: UnsupportedRuntimeGap[]): void {
  if (raw.endsWith(" (agent)")) return
  const parsed = parseReference(raw)
  if (parsed.gap) {
    gaps.push(parsed.gap)
    return
  }
  if (!parsed.mention) return
  const key = `${parsed.mention.path}\n${parsed.mention.lineStart ?? ""}\n${parsed.mention.lineEnd ?? ""}`
  if (seen.has(key)) return
  seen.add(key)
  mentions.push(parsed.mention)
}

export function extractAttachmentMentions(input: unknown): { mentions: AttachmentMention[]; gaps: UnsupportedRuntimeGap[] } {
  const mentions: AttachmentMention[] = []
  const gaps: UnsupportedRuntimeGap[] = []
  const seen = new Set<string>()

  for (const text of userTextBlocks(input)) {
    const quoted = /(^|\s)@"([^"]+)"|(^|\s)@'([^']+)'/gu
    const quotedRanges: Array<[number, number]> = []
    const candidates: Array<{ start: number; raw: string }> = []
    let quotedMatch: RegExpExecArray | null
    while ((quotedMatch = quoted.exec(text)) !== null) {
      const raw = quotedMatch[2] ?? quotedMatch[4]
      if (!raw) continue
      quotedRanges.push([quotedMatch.index, quoted.lastIndex])
      candidates.push({ start: quotedMatch.index, raw })
    }

    const regular = /(^|\s)@([^\s"']+)/gu
    let regularMatch: RegExpExecArray | null
    while ((regularMatch = regular.exec(text)) !== null) {
      const start = regularMatch.index
      if (quotedRanges.some(([from, to]) => start >= from && start < to)) continue
      const raw = regularMatch[2]
      if (!raw) continue
      candidates.push({ start, raw })
    }

    for (const candidate of candidates.sort((left, right) => left.start - right.start)) {
      pushMention(candidate.raw, seen, mentions, gaps)
    }
  }

  return { mentions, gaps }
}

function rangeSuffix(file: { lineStart?: number; lineEnd?: number }): string {
  if (file.lineStart === undefined) return ""
  return file.lineStart === file.lineEnd ? `:${file.lineStart}` : `:${file.lineStart}-${file.lineEnd}`
}

export function formatAttachmentMessage(file: { relativePath: string; text: string; lineStart?: number; lineEnd?: number }): string {
  return [`Bridge-generated automatic @file pre-read for ${file.relativePath}${rangeSuffix(file)}`, "", file.text].join("\n")
}

const UNSUPPORTED_ATTACHMENT_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic", ".svg", ".ipynb"])

function unsupportedFileType(path: string): boolean {
  return UNSUPPORTED_ATTACHMENT_EXTENSIONS.has(extname(path).toLowerCase())
}

function rangeGapPath(mention: AttachmentMention, relativePath: string): string {
  if (mention.lineStart === undefined) return relativePath
  const lineRange = mention.lineStart === mention.lineEnd ? `${mention.lineStart}` : `${mention.lineStart}-${mention.lineEnd}`
  return mention.raw.includes("#L") ? `${relativePath}#L${lineRange}` : `${relativePath}:${lineRange}`
}

function selectLineRange(text: string, mention: AttachmentMention, safeRangePath: string): { text?: string; gap?: UnsupportedRuntimeGap } {
  if (mention.lineStart === undefined) return { text }
  const lines = text.split("\n")
  const startIndex = mention.lineStart - 1
  if (startIndex >= lines.length) return { gap: attachmentGap("line range starts after end of file", safeRangePath) }
  const endIndex = mention.lineEnd ?? mention.lineStart
  return { text: lines.slice(startIndex, endIndex).join("\n") }
}

function evidenceDetail(mention: AttachmentMention, relativePath: string): string {
  if (mention.lineStart === undefined) return relativePath
  return mention.lineStart === mention.lineEnd ? `${relativePath}:${mention.lineStart}` : `${relativePath}:${mention.lineStart}-${mention.lineEnd}`
}

export async function loadAttachmentDomain(input: unknown, options: ResolvedBridgeOptions): Promise<AttachmentDomainResult> {
  const runtime = options.runtimeParity
  if (!runtime.enabled || !runtime.preReadFiles) return { insertedMessages: [], stateUsed: [], gaps: [] }
  if (runtime.preReadMessages.length > 0) return { insertedMessages: [], stateUsed: [], gaps: [] }

  const extracted = extractAttachmentMentions(input)
  if (extracted.mentions.length === 0) return { insertedMessages: [], stateUsed: [], gaps: extracted.gaps }

  if (!runtime.readWorkspaceFiles || !runtime.cwd) {
    return {
      insertedMessages: [],
      stateUsed: [],
      gaps: [
        ...extracted.gaps,
        attachmentGap("automatic @file reads require readWorkspaceFiles and runtimeParity.cwd"),
      ],
    }
  }

  const insertedMessages: Array<{ role: "system"; content: string }> = []
  const stateUsed: RuntimeStateEvidence[] = []
  const gaps: UnsupportedRuntimeGap[] = [...extracted.gaps]

  for (const mention of extracted.mentions) {
    const resolved = await resolveWorkspacePath(runtime.cwd, mention.path, { domain: "AttachmentDomain" })
    if ("domain" in resolved) {
      gaps.push(resolved)
      continue
    }

    if (unsupportedFileType(resolved.relativePath)) {
      gaps.push(attachmentGap("unsupported @file type", resolved.relativePath))
      continue
    }

    const read = await readWorkspaceTextFile(runtime.cwd, mention.path, runtime.maxMemoryBytes, {
      domain: "AttachmentDomain",
      preserveWhitespace: true,
    })
    if (!read.ok) {
      gaps.push(read.gap)
      continue
    }

    const selected = selectLineRange(read.text, mention, rangeGapPath(mention, read.relativePath))
    if (selected.gap) {
      gaps.push(selected.gap)
      continue
    }

    const text = selected.text ?? read.text
    insertedMessages.push({
      role: "system",
      content: formatAttachmentMessage({
        relativePath: read.relativePath,
        text,
        lineStart: mention.lineStart,
        lineEnd: mention.lineEnd,
      }),
    })
    stateUsed.push({ domain: "AttachmentDomain", source: "runtimeParity.cwd", detail: evidenceDetail(mention, read.relativePath) })
  }

  return { insertedMessages, stateUsed, gaps }
}
