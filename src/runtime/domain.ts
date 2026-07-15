export type RuntimeDomainName =
  | "MessageSessionDomain"
  | "WorkspaceMemoryDomain"
  | "AttachmentDomain"
  | "McpDomain"
  | "HooksPermissionDomain"
  | "CacheDomain"
  | "MetadataDomain"

export interface UnsupportedRuntimeGap {
  domain: RuntimeDomainName
  reason: string
  path?: string
}

export interface RuntimeStateEvidence {
  domain: RuntimeDomainName
  source: string
  detail?: string
}

export interface RequestFragment {
  domain: RuntimeDomainName
  target: "messages" | "system" | "tools" | "metadata" | "headers"
  value: unknown
}

export interface RuntimeDomainResult {
  fragments: RequestFragment[]
  stateUsed: RuntimeStateEvidence[]
  gaps: UnsupportedRuntimeGap[]
}
