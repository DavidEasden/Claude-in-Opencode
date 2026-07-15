import { readFile, realpath, stat } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { TextDecoder } from "node:util"
import type { RuntimeDomainName, UnsupportedRuntimeGap } from "./domain"

export type WorkspaceReadResult =
  | { ok: true; path: string; relativePath: string; text: string; bytes: number }
  | { ok: false; gap: UnsupportedRuntimeGap }

export interface WorkspaceReadOptions {
  domain?: RuntimeDomainName
  preserveWhitespace?: boolean
}

function normalizeRelative(path: string): string {
  return path.split(sep).join("/")
}

function isOutsideRelative(relativePath: string): boolean {
  return relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)
}

function diagnosticPath(path: string, cwdReal?: string): string {
  if (!isAbsolute(path)) return normalizeRelative(path)
  if (!cwdReal) return "<absolute-path>"

  const relativePath = relative(cwdReal, path)
  if (!isOutsideRelative(relativePath)) return normalizeRelative(relativePath)
  return "<absolute-path>"
}

function gap(reason: string, path: string, cwdReal?: string, domain: RuntimeDomainName = "WorkspaceMemoryDomain"): UnsupportedRuntimeGap {
  return { domain, reason, path: diagnosticPath(path, cwdReal) }
}

export function isProbablyBinary(buffer: Buffer): boolean {
  if (buffer.includes(0)) return true
  const sample = buffer.subarray(0, Math.min(buffer.length, 512))
  let control = 0
  for (const byte of sample) {
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) control += 1
  }
  return sample.length > 0 && control / sample.length > 0.1
}

export async function resolveWorkspacePath(
  cwd: string,
  inputPath: string,
  options: Pick<WorkspaceReadOptions, "domain"> = {},
): Promise<{ path: string; relativePath: string } | UnsupportedRuntimeGap> {
  const domain = options.domain ?? "WorkspaceMemoryDomain"
  let cwdReal: string
  try {
    cwdReal = await realpath(cwd)
  } catch {
    return gap("runtimeParity.cwd is unreadable or missing", inputPath, undefined, domain)
  }

  const candidate = isAbsolute(inputPath) ? inputPath : resolve(cwdReal, inputPath)
  const lexicalRelative = relative(cwdReal, candidate)
  if (isOutsideRelative(lexicalRelative)) {
    return gap("path resolves outside runtimeParity.cwd", inputPath, cwdReal, domain)
  }

  let candidateReal: string
  try {
    candidateReal = await realpath(candidate)
  } catch {
    return gap("file is unreadable or missing", inputPath, cwdReal, domain)
  }

  const relativePath = relative(cwdReal, candidateReal)
  if (!isOutsideRelative(relativePath)) {
    return { path: candidateReal, relativePath: normalizeRelative(relativePath) }
  }
  return gap("path resolves outside runtimeParity.cwd", inputPath, cwdReal, domain)
}

const utf8Decoder = new TextDecoder("utf-8", { fatal: true })

function decodeUtf8(buffer: Buffer): string | undefined {
  try {
    return utf8Decoder.decode(buffer)
  } catch {
    return undefined
  }
}

function normalizeText(text: string, preserveWhitespace: boolean): string {
  const decoded = text.replace(/^\ufeff/u, "").replace(/\r\n/gu, "\n")
  return preserveWhitespace ? decoded : decoded.trim()
}

export async function readWorkspaceTextFile(
  cwd: string,
  inputPath: string,
  maxBytes: number,
  options: WorkspaceReadOptions = {},
): Promise<WorkspaceReadResult> {
  const domain = options.domain ?? "WorkspaceMemoryDomain"
  const resolved = await resolveWorkspacePath(cwd, inputPath, { domain })
  if ("domain" in resolved) return { ok: false, gap: resolved }

  let info: Awaited<ReturnType<typeof stat>>
  try {
    info = await stat(resolved.path)
  } catch {
    return { ok: false, gap: gap("file is unreadable or missing", resolved.relativePath, undefined, domain) }
  }
  if (!info.isFile()) return { ok: false, gap: gap("path is not a file", resolved.relativePath, undefined, domain) }
  if (info.size > maxBytes) return { ok: false, gap: gap("file exceeds maxMemoryBytes", resolved.relativePath, undefined, domain) }

  let buffer: Buffer
  try {
    buffer = await readFile(resolved.path)
  } catch {
    return { ok: false, gap: gap("file is unreadable or missing", resolved.relativePath, undefined, domain) }
  }
  if (isProbablyBinary(buffer)) return { ok: false, gap: gap("file is not valid workspace text", resolved.relativePath, undefined, domain) }
  const text = decodeUtf8(buffer)
  if (text === undefined) return { ok: false, gap: gap("file is not valid workspace text", resolved.relativePath, undefined, domain) }
  return {
    ok: true,
    path: resolved.path,
    relativePath: resolved.relativePath,
    text: normalizeText(text, options.preserveWhitespace === true),
    bytes: buffer.byteLength,
  }
}
