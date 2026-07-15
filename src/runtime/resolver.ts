import type { ResolvedBridgeOptions } from "../types"
import type { RuntimeDomainName, RuntimeStateEvidence, UnsupportedRuntimeGap } from "./domain"
import { loadAttachmentDomain } from "./attachments"
import { runtimeSystemMessages } from "./hooks"
import { loadWorkspaceMemoryDomain, type WorkspaceMemoryLoadResult } from "./memory"
import { resolveMcpDomain } from "./mcp"
import { preReadSystemMessages } from "./pre-read"
import type { RuntimeParityContext, RuntimeParityState } from "./types"

interface RuntimeResolverParams {
  options: ResolvedBridgeOptions
  sessionID?: string
  state: RuntimeParityState
}

const emptyContext = (): RuntimeParityContext => ({
  insertedMessages: [],
  mirroredMcpTools: [],
  gaps: [],
  stateUsed: [],
})

function evidence(domain: RuntimeDomainName, source: string, detail?: string): RuntimeStateEvidence {
  return detail ? { domain, source, detail } : { domain, source }
}

function gap(domain: RuntimeDomainName, reason: string): UnsupportedRuntimeGap {
  return { domain, reason }
}

export async function resolveRuntimeDomains(input: unknown, params: RuntimeResolverParams): Promise<RuntimeParityContext> {
  const runtime = params.options.runtimeParity
  if (!runtime.enabled) return emptyContext()

  const context = emptyContext()

  const memory: WorkspaceMemoryLoadResult = params.options.userContextBlock
    ? { stateUsed: [], gaps: [] }
    : await loadWorkspaceMemoryDomain(params.options, params.state)
  if (memory.text) context.claudeMd = memory.text
  context.stateUsed.push(...memory.stateUsed)
  context.gaps.push(...memory.gaps)

  const preReadMessages = preReadSystemMessages(params.options)
  if (preReadMessages.length > 0) {
    context.insertedMessages.push(...preReadMessages)
    context.stateUsed.push(evidence("AttachmentDomain", "runtimeParity.preReadMessages", `${preReadMessages.length} message(s)`))
  } else {
    const attachments = await loadAttachmentDomain(input, params.options)
    context.insertedMessages.push(...attachments.insertedMessages)
    context.stateUsed.push(...attachments.stateUsed)
    context.gaps.push(...attachments.gaps)
  }

  const mcp = resolveMcpDomain(input, params.options)
  context.mirroredMcpTools = mcp.tools
  context.stateUsed.push(...mcp.stateUsed)
  context.gaps.push(...mcp.gaps)

  const hookMessages = runtimeSystemMessages(params.options)
  if (hookMessages.length > 0) {
    context.insertedMessages.push(...hookMessages)
    if (runtime.simulateHooks && runtime.hookSystemMessages.length > 0) {
      context.stateUsed.push(
        evidence("HooksPermissionDomain", "runtimeParity.hookSystemMessages", `${runtime.hookSystemMessages.length} message(s)`),
      )
    }
    if (runtime.simulatePermissions && runtime.permissionSystemMessages.length > 0) {
      context.stateUsed.push(
        evidence(
          "HooksPermissionDomain",
          "runtimeParity.permissionSystemMessages",
          `${runtime.permissionSystemMessages.length} message(s)`,
        ),
      )
    }
  }

  if (runtime.executeHooks) {
    context.gaps.push(gap("HooksPermissionDomain", "executeHooks requires Phase 3E hook executor"))
  }

  return context
}
