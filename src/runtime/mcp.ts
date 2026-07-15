import { isDeepStrictEqual } from "node:util"
import type { ResolvedBridgeOptions } from "../types"
import type { RuntimeStateEvidence, UnsupportedRuntimeGap } from "./domain"

export interface McpDomainResult {
  tools: Array<Record<string, unknown>>
  stateUsed: RuntimeStateEvidence[]
  gaps: UnsupportedRuntimeGap[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function mcpGap(reason: string): UnsupportedRuntimeGap {
  return { domain: "McpDomain", reason }
}

function validMcpName(name: string): boolean {
  return /^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+$/u.test(name)
}

function normalizeTool(tool: Record<string, unknown>): Record<string, unknown> {
  const { eager_input_streaming: _eagerInputStreaming, ...rest } = tool
  return structuredClone(rest)
}

function validateTool(value: unknown): { tool?: Record<string, unknown>; gap?: UnsupportedRuntimeGap } {
  if (!isRecord(value) || typeof value.name !== "string" || !validMcpName(value.name)) {
    return { gap: mcpGap("invalid MCP tool name") }
  }
  if (!isRecord(value.input_schema) || value.input_schema.type !== "object") {
    return { gap: mcpGap("missing or invalid MCP input_schema") }
  }
  if (value.description !== undefined && typeof value.description !== "string") {
    return { gap: mcpGap("invalid MCP tool description") }
  }
  return { tool: normalizeTool(value) }
}

function liveCandidates(input: unknown): unknown[] {
  if (!isRecord(input) || !Array.isArray(input.tools)) return []
  return input.tools.filter((tool) => isRecord(tool) && typeof tool.name === "string" && tool.name.startsWith("mcp__"))
}

export function resolveMcpDomain(input: unknown, options: ResolvedBridgeOptions): McpDomainResult {
  const runtime = options.runtimeParity
  if (!runtime.enabled) return { tools: [], stateUsed: [], gaps: [] }

  const gaps: UnsupportedRuntimeGap[] = []
  if (runtime.executeMcpServers) {
    gaps.push(mcpGap("MCP server lifecycle is owned by OpenCode; independent execution is unsupported"))
  }
  if (!runtime.mirrorMcpTools) return { tools: [], stateUsed: [], gaps }

  const tools: Array<Record<string, unknown>> = []
  const byName = new Map<string, Record<string, unknown>>()
  let liveCount = 0
  let replayCount = 0

  for (const candidate of liveCandidates(input)) {
    const validated = validateTool(candidate)
    if (validated.gap) {
      gaps.push(validated.gap)
      continue
    }
    const tool = validated.tool
    if (!tool) continue
    const name = String(tool.name)
    const existing = byName.get(name)
    if (existing) {
      if (!isDeepStrictEqual(existing, tool)) gaps.push(mcpGap("conflicting MCP tool definitions"))
      continue
    }
    byName.set(name, tool)
    tools.push(tool)
    liveCount += 1
  }

  for (const candidate of runtime.mcpTools) {
    const candidateName = isRecord(candidate) && typeof candidate.name === "string" ? candidate.name : undefined
    if (candidateName !== undefined && byName.has(candidateName)) continue

    const validated = validateTool(candidate)
    if (validated.gap) {
      gaps.push(validated.gap)
      continue
    }
    const tool = validated.tool
    if (!tool) continue
    const name = String(tool.name)
    if (byName.has(name)) continue
    byName.set(name, tool)
    tools.push(tool)
    replayCount += 1
  }

  const stateUsed: RuntimeStateEvidence[] = []
  if (liveCount > 0) stateUsed.push({ domain: "McpDomain", source: "opencode request tools", detail: `${liveCount} tool(s)` })
  if (replayCount > 0) stateUsed.push({ domain: "McpDomain", source: "runtimeParity.mcpTools", detail: `${replayCount} tool(s)` })

  return { tools, stateUsed, gaps }
}

export function mirrorMcpTools(input: unknown, options: ResolvedBridgeOptions): Array<Record<string, unknown>> {
  return resolveMcpDomain(input, options).tools
}
