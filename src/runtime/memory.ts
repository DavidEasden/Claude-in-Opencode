import { readdir, realpath, stat } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import type { ResolvedBridgeOptions } from "../types"
import type { RuntimeStateEvidence, UnsupportedRuntimeGap } from "./domain"
import type { RuntimeParityState } from "./types"
import { readWorkspaceTextFile } from "./workspace"

const MEMORY_PREAMBLE =
  "Codebase and user instructions are shown below. Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior and you MUST follow them exactly as written."
const INCLUDE_PATTERN = /^\s*@include\s+(.+)\s*$/
const MAX_INCLUDE_DEPTH = 8

type MemoryKind = "Project" | "Local"

interface MemoryFile {
  relativePath: string
  kind: MemoryKind
  content: string
}

interface ParsedFrontmatter {
  content: string
  paths?: string[]
  gap?: UnsupportedRuntimeGap
}

export interface WorkspaceMemoryLoadResult {
  text?: string
  stateUsed: RuntimeStateEvidence[]
  gaps: UnsupportedRuntimeGap[]
}

function formatMemory(files: MemoryFile[]): string | undefined {
  if (files.length === 0) return undefined
  const sections = files.map((file) => {
    const suffix =
      file.kind === "Project"
        ? " (project instructions, checked into the codebase)"
        : " (user's private project instructions, not checked in)"
    return `Contents of ${file.relativePath}${suffix}:\n\n${file.content}`
  })
  return `${MEMORY_PREAMBLE}\n\n${sections.join("\n\n")}`
}

function normalizeRelative(path: string): string {
  return path.split(sep).join("/")
}

function isOutsideRelative(relativePath: string): boolean {
  return relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)
}

function hasParentTraversal(path: string): boolean {
  return path.split(/[\\/]+/u).includes("..")
}

function diagnosticPath(path: string, cwdReal?: string): string {
  if (!isAbsolute(path)) return normalizeRelative(path)
  if (!cwdReal) return "<absolute-path>"

  const relativePath = relative(cwdReal, path)
  if (!isOutsideRelative(relativePath)) return normalizeRelative(relativePath)
  return "<absolute-path>"
}

function workspaceMemoryGap(reason: string, path?: string, cwdReal?: string): UnsupportedRuntimeGap {
  return path
    ? { domain: "WorkspaceMemoryDomain", reason, path: diagnosticPath(path, cwdReal) }
    : { domain: "WorkspaceMemoryDomain", reason }
}

function stripIncludeQuotes(path: string): string {
  const trimmed = path.trim()
  const quote = trimmed[0]
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) return trimmed.slice(1, -1)
  return trimmed
}

function parseFrontmatterPathValue(value: string): string | undefined {
  const trimmed = stripIncludeQuotes(value)
  return trimmed.length > 0 ? trimmed : undefined
}

function parseFrontmatterInlinePaths(value: string): string[] | undefined {
  if (!value.startsWith("[") || !value.endsWith("]")) return undefined
  const inner = value.slice(1, -1).trim()
  if (!inner) return []

  const paths: string[] = []
  for (const item of inner.split(",")) {
    const path = parseFrontmatterPathValue(item)
    if (!path) return undefined
    paths.push(path)
  }
  return paths
}

function parseFrontmatter(text: string, relativePath: string): ParsedFrontmatter {
  const lines = text.split(/\r?\n/u)
  if (lines[0] !== "---") return { content: text }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---")
  if (closingIndex === -1) {
    return { content: text, gap: workspaceMemoryGap("unsupported frontmatter paths syntax", relativePath) }
  }

  const content = lines.slice(closingIndex + 1).join("\n")
  const frontmatterLines = lines.slice(1, closingIndex)
  let paths: string[] | undefined
  let readingPathsList = false

  for (const line of frontmatterLines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (readingPathsList) {
      const item = /^\s+-\s*(.+)$/u.exec(line)
      if (item) {
        const path = parseFrontmatterPathValue(item[1])
        if (!path) return { content, gap: workspaceMemoryGap("unsupported frontmatter paths syntax", relativePath) }
        paths?.push(path)
        continue
      }
    }

    const key = /^([^:\s]+)\s*:(.*)$/u.exec(trimmed)
    if (!key) return { content, gap: workspaceMemoryGap("unsupported frontmatter paths syntax", relativePath) }
    if (key[1] !== "paths") return { content, gap: workspaceMemoryGap("unsupported frontmatter key", relativePath) }
    if (paths !== undefined) return { content, gap: workspaceMemoryGap("unsupported frontmatter paths syntax", relativePath) }

    const value = key[2].trim()
    if (!value) {
      paths = []
      readingPathsList = true
      continue
    }

    const inlinePaths = parseFrontmatterInlinePaths(value)
    if (!inlinePaths) return { content, gap: workspaceMemoryGap("unsupported frontmatter paths syntax", relativePath) }
    paths = inlinePaths
  }

  return paths ? { content, paths } : { content }
}

function normalizeMatchPath(path: string): string {
  return path.replace(/\\/gu, "/").replace(/^\.\//u, "")
}

function frontmatterPathEscapesCwd(path: string): boolean {
  const normalized = normalizeMatchPath(path)
  return isAbsolute(path) || /^[A-Za-z]:[\\/]/u.test(path) || normalized.split("/").includes("..")
}

function matchesActivePath(pattern: string, activePath: string): boolean {
  const normalizedPattern = normalizeMatchPath(pattern)
  const normalizedActivePath = normalizeMatchPath(activePath)
  if (normalizedPattern === normalizedActivePath) return true

  if (normalizedPattern.endsWith("/**")) {
    const prefix = normalizedPattern.slice(0, -2)
    return normalizedActivePath.startsWith(prefix)
  }

  return false
}

function selectFrontmatterContent(
  text: string,
  relativePath: string,
  activePaths: string[],
): { content?: string; gaps: UnsupportedRuntimeGap[] } {
  const parsed = parseFrontmatter(text, relativePath)
  const gaps = parsed.gap ? [parsed.gap] : []
  if (parsed.gap) return { gaps }

  if (!parsed.paths) return { content: parsed.content, gaps }

  if (parsed.paths.some(frontmatterPathEscapesCwd)) {
    gaps.push(workspaceMemoryGap("frontmatter path resolves outside runtimeParity.cwd", relativePath))
    return { gaps }
  }

  if (activePaths.length === 0) {
    gaps.push(workspaceMemoryGap("frontmatter paths require runtimeParity.activePaths", relativePath))
    return { gaps }
  }

  const matches = parsed.paths.some((pattern) => activePaths.some((activePath) => matchesActivePath(pattern, activePath)))
  return matches ? { content: parsed.content, gaps } : { gaps }
}

function includeInputPath(currentRelativePath: string, includePath: string): string {
  if (isAbsolute(includePath)) return includePath
  const currentDir = dirname(currentRelativePath)
  return currentDir === "." ? includePath : `${currentDir}/${includePath}`
}

async function expandIncludes(params: {
  cwd: string
  currentFile: string
  relativePath: string
  text: string
  maxBytes: number
  seen: Set<string>
  depth: number
}): Promise<{ text: string; stateUsed: RuntimeStateEvidence[]; gaps: UnsupportedRuntimeGap[] }> {
  if (params.depth > MAX_INCLUDE_DEPTH) {
    return {
      text: "",
      stateUsed: [],
      gaps: [workspaceMemoryGap("memory @include depth limit exceeded", params.relativePath)],
    }
  }

  const currentReal = await realpath(params.currentFile)
  if (params.seen.has(currentReal)) {
    return {
      text: "",
      stateUsed: [],
      gaps: [workspaceMemoryGap("memory @include cycle detected", params.relativePath)],
    }
  }

  const nextSeen = new Set(params.seen)
  nextSeen.add(currentReal)

  const stateUsed: RuntimeStateEvidence[] = []
  const gaps: UnsupportedRuntimeGap[] = []
  const lines = params.text.split(/\r?\n/u)
  const expandedLines: string[] = []

  for (const line of lines) {
    const match = INCLUDE_PATTERN.exec(line)
    if (!match) {
      expandedLines.push(line)
      continue
    }

    const includePath = stripIncludeQuotes(match[1])
    const result = await readWorkspaceTextFile(params.cwd, includeInputPath(params.relativePath, includePath), params.maxBytes)
    if (!result.ok) {
      gaps.push(result.gap)
      expandedLines.push("")
      continue
    }

    stateUsed.push({ domain: "WorkspaceMemoryDomain", source: "@include", detail: result.relativePath })
    const expanded = await expandIncludes({
      cwd: params.cwd,
      currentFile: result.path,
      relativePath: result.relativePath,
      text: result.text,
      maxBytes: params.maxBytes,
      seen: nextSeen,
      depth: params.depth + 1,
    })
    stateUsed.push(...expanded.stateUsed)
    gaps.push(...expanded.gaps)
    expandedLines.push(expanded.text)
  }

  return { text: expandedLines.join("\n"), stateUsed, gaps }
}

async function memoryDirectories(cwd: string, memoryStartDir?: string): Promise<{ dirs: string[]; gap?: UnsupportedRuntimeGap }> {
  let cwdReal: string
  try {
    cwdReal = await realpath(cwd)
  } catch {
    return { dirs: [], gap: workspaceMemoryGap("runtimeParity.cwd is unreadable or missing") }
  }

  if (memoryStartDir && hasParentTraversal(memoryStartDir)) {
    return {
      dirs: [],
      gap: workspaceMemoryGap("memoryStartDir parent traversal is unsupported", memoryStartDir, cwdReal),
    }
  }

  const startInput = memoryStartDir ?? cwdReal
  const startPath = isAbsolute(startInput) ? startInput : resolve(cwdReal, startInput)

  let startReal: string
  try {
    startReal = await realpath(startPath)
  } catch {
    return { dirs: [], gap: workspaceMemoryGap("memoryStartDir is unreadable or missing", memoryStartDir ?? startInput, cwdReal) }
  }

  const realRelative = relative(cwdReal, startReal)
  if (isOutsideRelative(realRelative)) {
    return {
      dirs: [],
      gap: workspaceMemoryGap("memoryStartDir resolves outside runtimeParity.cwd", memoryStartDir ?? startInput, cwdReal),
    }
  }

  if (memoryStartDir) {
    const startInfo = await stat(startReal)
    if (!startInfo.isDirectory()) {
      return { dirs: [], gap: workspaceMemoryGap("memoryStartDir is not a directory", memoryStartDir, cwdReal) }
    }
  }

  const dirs: string[] = []
  let dir = startReal
  while (true) {
    const dirRelative = relative(cwdReal, dir)
    if (isOutsideRelative(dirRelative)) break
    dirs.unshift(dir)
    if (dirRelative === "") break
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return { dirs }
}

async function discoverRuleFiles(cwd: string, dirs: string[]): Promise<string[]> {
  const ruleFiles: string[] = []
  for (const dir of dirs) {
    const rulesDir = join(dir, ".claude", "rules")
    try {
      const rulesDirReal = await realpath(rulesDir)
      if (isOutsideRelative(relative(cwd, rulesDirReal))) continue
      const entries = await readdir(rulesDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".md")) ruleFiles.push(join(rulesDir, entry.name))
      }
    } catch {
      continue
    }
  }

  return ruleFiles.sort((left, right) =>
    normalizeRelative(relative(cwd, left)).localeCompare(normalizeRelative(relative(cwd, right))),
  )
}

export async function loadWorkspaceMemoryDomain(
  options: ResolvedBridgeOptions,
  state: RuntimeParityState,
): Promise<WorkspaceMemoryLoadResult> {
  const runtime = options.runtimeParity
  if (!runtime.enabled || !runtime.scanClaudeMd || !runtime.cwd) return { stateUsed: [], gaps: [] }
  if (!runtime.readWorkspaceFiles) {
    return {
      text: undefined,
      stateUsed: [],
      gaps: [
        {
          domain: "WorkspaceMemoryDomain",
          reason: "scanClaudeMd requires readWorkspaceFiles for disk-backed memory parity",
        },
      ],
    }
  }

  const activePathsKey = JSON.stringify(runtime.activePaths.map(normalizeMatchPath).sort())
  const cacheKey = [runtime.cwd, runtime.memoryStartDir ?? "", activePathsKey].join("\n")
  if (runtime.cache) {
    const cached = state.memoryByCwd.get(cacheKey)
    if (cached) {
      return {
        text: cached.text,
        stateUsed: [{ domain: "WorkspaceMemoryDomain", source: "runtimeParity.cwd", detail: "cached memory text" }],
        gaps: [],
      }
    }
  }

  const directoryResult = await memoryDirectories(runtime.cwd, runtime.memoryStartDir)
  if (directoryResult.gap) {
    return { text: undefined, stateUsed: [], gaps: [directoryResult.gap] }
  }

  const baseCandidates = [
    { path: "CLAUDE.md", kind: "Project" as const },
    { path: ".claude/CLAUDE.md", kind: "Project" as const },
    { path: "CLAUDE.local.md", kind: "Local" as const },
  ]

  const files: MemoryFile[] = []
  const gaps: UnsupportedRuntimeGap[] = []
  const includeStateUsed: RuntimeStateEvidence[] = []
  for (const dir of directoryResult.dirs) {
    for (const candidate of baseCandidates) {
      const result = await readWorkspaceTextFile(runtime.cwd, join(dir, candidate.path), runtime.maxMemoryBytes)
      if (!result.ok) {
        if (result.gap.reason !== "file is unreadable or missing") gaps.push(result.gap)
        continue
      }
      if (result.text) {
        const expanded = await expandIncludes({
          cwd: runtime.cwd,
          currentFile: result.path,
          relativePath: result.relativePath,
          text: result.text,
          maxBytes: runtime.maxMemoryBytes,
          seen: new Set(),
          depth: 0,
        })
        gaps.push(...expanded.gaps)
        includeStateUsed.push(...expanded.stateUsed)
        files.push({ relativePath: result.relativePath, kind: candidate.kind, content: expanded.text })
      }
    }
  }

  const ruleFiles = await discoverRuleFiles(directoryResult.dirs[0] ?? runtime.cwd, directoryResult.dirs)
  for (const ruleFile of ruleFiles) {
    const result = await readWorkspaceTextFile(runtime.cwd, ruleFile, runtime.maxMemoryBytes)
    if (!result.ok) {
      if (result.gap.reason !== "file is unreadable or missing") gaps.push(result.gap)
      continue
    }
    if (result.text) {
      const selected = selectFrontmatterContent(result.text, result.relativePath, runtime.activePaths)
      gaps.push(...selected.gaps)
      if (!selected.content) continue

      const expanded = await expandIncludes({
        cwd: runtime.cwd,
        currentFile: result.path,
        relativePath: result.relativePath,
        text: selected.content,
        maxBytes: runtime.maxMemoryBytes,
        seen: new Set(),
        depth: 0,
      })
      gaps.push(...expanded.gaps)
      includeStateUsed.push(...expanded.stateUsed)
      files.push({ relativePath: result.relativePath, kind: "Project", content: expanded.text })
    }
  }

  const text = formatMemory(files)
  if (text && runtime.cache) state.memoryByCwd.set(cacheKey, { text, loadedAt: Date.now() })
  return {
    text,
    stateUsed: text
      ? [{ domain: "WorkspaceMemoryDomain", source: "runtimeParity.cwd", detail: `${files.length} memory file(s)` }, ...includeStateUsed]
      : [],
    gaps,
  }
}

export async function loadWorkspaceMemory(
  options: ResolvedBridgeOptions,
  state: RuntimeParityState,
): Promise<string | undefined> {
  return (await loadWorkspaceMemoryDomain(options, state)).text
}
