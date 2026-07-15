import { CLAUDE_CODE_CONTEXT_MANAGEMENT, CLAUDE_CODE_METADATA } from "../claude-code/template"
import { isSourceCompatibleProfile } from "../profile/claude-code-profile"
import { buildProfileUserID } from "../profile/metadata"
import type { AnthropicRequestBody, ResolvedBridgeOptions } from "../types"

interface ClaudeCodeMetadataContext {
  sessionID?: string
  options: ResolvedBridgeOptions
}

function parseCapturedUserID(): { device_id: string; account_uuid: string; session_id: string } {
  const metadata = CLAUDE_CODE_METADATA as { user_id?: unknown }
  if (typeof metadata.user_id !== "string") return { device_id: "", account_uuid: "", session_id: "" }

  return JSON.parse(metadata.user_id) as { device_id: string; account_uuid: string; session_id: string }
}

export function applyClaudeCodeMetadata(
  body: AnthropicRequestBody,
  context: ClaudeCodeMetadataContext,
): AnthropicRequestBody {
  const capturedUserID = parseCapturedUserID()
  const userID = buildProfileUserID({
    deviceId: context.options.deviceId,
    accountUuid: context.options.accountUuid,
    sessionId: context.options.sessionId ?? context.sessionID,
    stableFakeMetadata: isSourceCompatibleProfile(context.options) && context.options.runtimeParity.stableFakeMetadata,
    fallback: capturedUserID,
  })

  return {
    ...body,
    metadata: { user_id: userID },
    context_management: structuredClone(CLAUDE_CODE_CONTEXT_MANAGEMENT),
  }
}
