import { CLAUDE_CODE_TOOLS } from "../claude-code/template"
import { claudeCodeToolName } from "./tool-names"
import type { ResolvedBridgeOptions } from "../types"

type ToolsOptions = Pick<ResolvedBridgeOptions, "toolNames">

export function usesDefaultToolSet(options: ToolsOptions): boolean {
  return options.toolNames === undefined
}

export function transformTools(
  _tools: unknown,
  options: ToolsOptions = {},
  runtimeTools: Array<Record<string, unknown>> = [],
): unknown {
  if (usesDefaultToolSet(options)) return [...structuredClone(CLAUDE_CODE_TOOLS), ...structuredClone(runtimeTools)]

  const requestedToolNames = new Set((options.toolNames ?? []).map(claudeCodeToolName))
  const builtInTools = CLAUDE_CODE_TOOLS.filter((tool) => requestedToolNames.has(tool.name))
  return [...structuredClone(builtInTools), ...structuredClone(runtimeTools)]
}
