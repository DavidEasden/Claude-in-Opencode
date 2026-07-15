import * as fs from "node:fs/promises"
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { readWorkspaceTextFile, resolveWorkspacePath } from "../../src/runtime/workspace"

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return {
    ...actual,
    stat: vi.fn(actual.stat),
    readFile: vi.fn(actual.readFile),
  }
})

describe("workspace reader", () => {
  it("reads text files inside cwd and reports cwd-relative paths", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-workspace-"))
    await mkdir(join(cwd, "docs"), { recursive: true })
    await writeFile(join(cwd, "docs", "memory.md"), "Use strict parity.")

    const result = await readWorkspaceTextFile(cwd, "docs/memory.md", 1024)

    expect(result).toMatchObject({ ok: true, relativePath: "docs/memory.md", text: "Use strict parity." })
  })

  it("rejects parent traversal outside cwd", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-workspace-"))
    const result = await resolveWorkspacePath(cwd, "../outside.md")

    expect(result).toEqual({
      domain: "WorkspaceMemoryDomain",
      reason: "path resolves outside runtimeParity.cwd",
      path: "../outside.md",
    })
  })

  it("does not expose absolute outside paths in diagnostics", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-workspace-"))
    const outside = await mkdtemp(join(tmpdir(), "bridge-outside-"))
    const outsidePath = join(outside, "secret.md")
    await writeFile(outsidePath, "outside")

    const result = await resolveWorkspacePath(cwd, outsidePath)

    expect(result).toEqual({
      domain: "WorkspaceMemoryDomain",
      reason: "path resolves outside runtimeParity.cwd",
      path: "<absolute-path>",
    })
  })

  it("returns a workspace gap when cwd is missing", async () => {
    const cwd = join(tmpdir(), `bridge-missing-cwd-${process.pid}-${Date.now()}`)

    await expect(resolveWorkspacePath(cwd, "memory.md")).resolves.toEqual({
      domain: "WorkspaceMemoryDomain",
      reason: "runtimeParity.cwd is unreadable or missing",
      path: "memory.md",
    })
  })

  it("reads files in cwd directories whose names start with dot dot", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-workspace-"))
    await mkdir(join(cwd, "..notes"), { recursive: true })
    await writeFile(join(cwd, "..notes", "memory.md"), "Allowed sibling-looking name.")

    const result = await readWorkspaceTextFile(cwd, "..notes/memory.md", 1024)

    expect(result).toMatchObject({ ok: true, relativePath: "..notes/memory.md", text: "Allowed sibling-looking name." })
  })

  it("rejects symlink escape outside cwd", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-workspace-"))
    const outside = await mkdtemp(join(tmpdir(), "bridge-outside-"))
    await writeFile(join(outside, "secret.md"), "outside")
    await symlink(join(outside, "secret.md"), join(cwd, "link.md"))

    const result = await readWorkspaceTextFile(cwd, "link.md", 1024)

    expect(result).toEqual({
      ok: false,
      gap: { domain: "WorkspaceMemoryDomain", reason: "path resolves outside runtimeParity.cwd", path: "link.md" },
    })
  })

  it("rejects oversized files without reading text content", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-workspace-"))
    await writeFile(join(cwd, "large.md"), "x".repeat(16))

    const result = await readWorkspaceTextFile(cwd, "large.md", 4)

    expect(result).toEqual({
      ok: false,
      gap: { domain: "WorkspaceMemoryDomain", reason: "file exceeds maxMemoryBytes", path: "large.md" },
    })
  })

  it("rejects binary-looking files", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-workspace-"))
    await writeFile(join(cwd, "binary.md"), Buffer.from([0x23, 0x20, 0x00, 0x41]))

    const result = await readWorkspaceTextFile(cwd, "binary.md", 1024)

    expect(result).toEqual({
      ok: false,
      gap: { domain: "WorkspaceMemoryDomain", reason: "file is not valid workspace text", path: "binary.md" },
    })
  })

  it("returns a gap when stat fails after path resolution", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-workspace-stat-"))
    await writeFile(join(cwd, "vanished.md"), "gone")
    vi.mocked(fs.stat).mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))

    await expect(readWorkspaceTextFile(cwd, "vanished.md", 1024)).resolves.toEqual({
      ok: false,
      gap: { domain: "WorkspaceMemoryDomain", reason: "file is unreadable or missing", path: "vanished.md" },
    })
  })

  it("returns a gap when readFile fails after stat", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-workspace-read-"))
    await writeFile(join(cwd, "denied.md"), "secret")
    vi.mocked(fs.readFile).mockRejectedValueOnce(Object.assign(new Error("EACCES"), { code: "EACCES" }))

    await expect(readWorkspaceTextFile(cwd, "denied.md", 1024)).resolves.toEqual({
      ok: false,
      gap: { domain: "WorkspaceMemoryDomain", reason: "file is unreadable or missing", path: "denied.md" },
    })
  })

  it("uses caller-supplied runtime domain for gaps", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-workspace-domain-"))

    const result = await readWorkspaceTextFile(cwd, "../outside.txt", 1024, { domain: "AttachmentDomain" })

    expect(result).toEqual({
      ok: false,
      gap: { domain: "AttachmentDomain", reason: "path resolves outside runtimeParity.cwd", path: "../outside.txt" },
    })
  })

  it("preserves attachment whitespace while keeping memory default trimming", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-workspace-whitespace-"))
    await writeFile(join(cwd, "src.txt"), "\ufeff  alpha\r\n beta\n")

    const memory = await readWorkspaceTextFile(cwd, "src.txt", 1024)
    const attachment = await readWorkspaceTextFile(cwd, "src.txt", 1024, {
      domain: "AttachmentDomain",
      preserveWhitespace: true,
    })

    expect(memory).toMatchObject({ ok: true, text: "alpha\n beta" })
    expect(attachment).toMatchObject({ ok: true, text: "  alpha\n beta\n" })
  })
})
