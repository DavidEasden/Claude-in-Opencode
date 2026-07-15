import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { resolveBridgeOptions } from "../../src/config"
import { loadWorkspaceMemory, loadWorkspaceMemoryDomain } from "../../src/runtime/memory"
import { createRuntimeParityState } from "../../src/runtime/state"

describe("loadWorkspaceMemory", () => {
  it("formats explicit-cwd CLAUDE.md and CLAUDE.local.md like Claude Code memory context", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-"))
    await writeFile(join(cwd, "CLAUDE.md"), "# Project\nUse strict parity.")
    await writeFile(join(cwd, "CLAUDE.local.md"), "# Local\nPrivate note.")

    const text = await loadWorkspaceMemory(
      resolveBridgeOptions({ runtimeParity: { cwd, scanClaudeMd: true, readWorkspaceFiles: true } }),
      createRuntimeParityState(),
    )

    expect(text).toContain("Codebase and user instructions are shown below.")
    expect(text).toContain("Contents of CLAUDE.md (project instructions, checked into the codebase):")
    expect(text).toContain("# Project\nUse strict parity.")
    expect(text).toContain(
      "Contents of CLAUDE.local.md (user's private project instructions, not checked in):",
    )
    expect(text).toContain("# Local\nPrivate note.")
  })

  it("does not scan when cwd is omitted", async () => {
    const text = await loadWorkspaceMemory(
      resolveBridgeOptions({ runtimeParity: { scanClaudeMd: true } }),
      createRuntimeParityState(),
    )

    expect(text).toBeUndefined()
  })

  it("includes .claude/CLAUDE.md only for fixture-covered project memory files", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-rules-"))
    await mkdir(join(cwd, ".claude"), { recursive: true })
    await writeFile(join(cwd, ".claude", "CLAUDE.md"), "Nested project instruction.")

    const text = await loadWorkspaceMemory(
      resolveBridgeOptions({ runtimeParity: { cwd, scanClaudeMd: true, readWorkspaceFiles: true } }),
      createRuntimeParityState(),
    )

    expect(text).toContain(
      "Contents of .claude/CLAUDE.md (project instructions, checked into the codebase):",
    )
  })

  it("does not read disk when scanClaudeMd is true but readWorkspaceFiles is false", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-gate-"))
    await writeFile(join(cwd, "CLAUDE.md"), "Should not be read.")

    const result = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({ runtimeParity: { cwd, scanClaudeMd: true } }),
      createRuntimeParityState(),
    )

    expect(result).toEqual({
      text: undefined,
      stateUsed: [],
      gaps: [
        {
          domain: "WorkspaceMemoryDomain",
          reason: "scanClaudeMd requires readWorkspaceFiles for disk-backed memory parity",
        },
      ],
    })
  })

  it("loads cwd-confined root memory when readWorkspaceFiles is enabled", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-domain-"))
    await writeFile(join(cwd, "CLAUDE.md"), "# Project\nUse strict parity.")

    const result = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({ runtimeParity: { cwd, scanClaudeMd: true, readWorkspaceFiles: true } }),
      createRuntimeParityState(),
    )

    expect(result.text).toContain("Contents of CLAUDE.md (project instructions, checked into the codebase):")
    expect(result.text).toContain("# Project\nUse strict parity.")
    expect(result.stateUsed).toEqual([
      { domain: "WorkspaceMemoryDomain", source: "runtimeParity.cwd", detail: "1 memory file(s)" },
    ])
    expect(result.gaps).toEqual([])
  })

  it("scans from memoryStartDir upward only until runtimeParity.cwd", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-boundary-"))
    const app = join(cwd, "packages", "app")
    await mkdir(app, { recursive: true })
    await writeFile(join(cwd, "CLAUDE.md"), "Root memory.")
    await writeFile(join(cwd, "packages", "app", "CLAUDE.md"), "App memory.")

    const result = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({ runtimeParity: { cwd, memoryStartDir: app, scanClaudeMd: true, readWorkspaceFiles: true } }),
      createRuntimeParityState(),
    )

    expect(result.text).toContain("Contents of CLAUDE.md (project instructions, checked into the codebase):")
    expect(result.text).toContain("Root memory.")
    expect(result.text).toContain("Contents of packages/app/CLAUDE.md (project instructions, checked into the codebase):")
    expect(result.text).toContain("App memory.")
    expect(result.gaps).toEqual([])
  })

  it("rejects memoryStartDir outside runtimeParity.cwd", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-root-"))
    const outside = await mkdtemp(join(tmpdir(), "bridge-memory-outside-"))

    const result = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({ runtimeParity: { cwd, memoryStartDir: outside, scanClaudeMd: true, readWorkspaceFiles: true } }),
      createRuntimeParityState(),
    )

    expect(result).toEqual({
      text: undefined,
      stateUsed: [],
      gaps: [
        { domain: "WorkspaceMemoryDomain", reason: "memoryStartDir resolves outside runtimeParity.cwd", path: "<absolute-path>" },
      ],
    })
  })

  it("rejects memoryStartDir that points to a file inside runtimeParity.cwd", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-file-start-"))
    await writeFile(join(cwd, "file.md"), "Not a directory.")

    const result = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({
        runtimeParity: { cwd, memoryStartDir: "file.md", scanClaudeMd: true, readWorkspaceFiles: true },
      }),
      createRuntimeParityState(),
    )

    expect(result).toEqual({
      text: undefined,
      stateUsed: [],
      gaps: [{ domain: "WorkspaceMemoryDomain", reason: "memoryStartDir is not a directory", path: "file.md" }],
    })
  })

  it("includes direct .claude/rules markdown files in stable order", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-rules-"))
    await mkdir(join(cwd, ".claude", "rules"), { recursive: true })
    await writeFile(join(cwd, ".claude", "rules", "b.md"), "Rule B")
    await writeFile(join(cwd, ".claude", "rules", "a.md"), "Rule A")

    const result = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({ runtimeParity: { cwd, scanClaudeMd: true, readWorkspaceFiles: true } }),
      createRuntimeParityState(),
    )

    expect(result.text?.indexOf("Rule A")).toBeLessThan(result.text?.indexOf("Rule B") ?? 0)
    expect(result.text).toContain("Contents of .claude/rules/a.md (project instructions, checked into the codebase):")
    expect(result.text).toContain("Contents of .claude/rules/b.md (project instructions, checked into the codebase):")
    expect(result.gaps).toEqual([])
  })

  it("inlines memory @include directives relative to the current file", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-include-"))
    await mkdir(join(cwd, "docs"), { recursive: true })
    await writeFile(join(cwd, "CLAUDE.md"), "Before\n@include docs/extra.md\nAfter")
    await writeFile(join(cwd, "docs", "extra.md"), "Included memory")

    const result = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({ runtimeParity: { cwd, scanClaudeMd: true, readWorkspaceFiles: true } }),
      createRuntimeParityState(),
    )

    expect(result.text).toContain("Before\nIncluded memory\nAfter")
    expect(result.stateUsed).toContainEqual({ domain: "WorkspaceMemoryDomain", source: "@include", detail: "docs/extra.md" })
    expect(result.gaps).toEqual([])
  })

  it("reports include loops as gaps", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-include-loop-"))
    await writeFile(join(cwd, "CLAUDE.md"), "@include loop.md")
    await writeFile(join(cwd, "loop.md"), "@include CLAUDE.md")

    const result = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({ runtimeParity: { cwd, scanClaudeMd: true, readWorkspaceFiles: true } }),
      createRuntimeParityState(),
    )

    expect(result.gaps).toContainEqual({
      domain: "WorkspaceMemoryDomain",
      reason: "memory @include cycle detected",
      path: "CLAUDE.md",
    })
  })

  it("reports include paths outside cwd as gaps", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-include-escape-"))
    await writeFile(join(cwd, "CLAUDE.md"), "@include ../outside.md")

    const result = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({ runtimeParity: { cwd, scanClaudeMd: true, readWorkspaceFiles: true } }),
      createRuntimeParityState(),
    )

    expect(result.gaps).toContainEqual({
      domain: "WorkspaceMemoryDomain",
      reason: "path resolves outside runtimeParity.cwd",
      path: "../outside.md",
    })
  })

  it("includes frontmatter paths rules when activePaths match", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-frontmatter-"))
    await mkdir(join(cwd, ".claude", "rules"), { recursive: true })
    await writeFile(join(cwd, ".claude", "rules", "src.md"), "---\npaths:\n  - src/**\n---\nUse source rules.")

    const result = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({
        runtimeParity: { cwd, scanClaudeMd: true, readWorkspaceFiles: true, activePaths: ["src/index.ts"] },
      }),
      createRuntimeParityState(),
    )

    expect(result.text).toContain("Use source rules.")
    expect(result.gaps).toEqual([])
  })

  it("skips frontmatter paths rules when activePaths do not match", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-frontmatter-skip-"))
    await mkdir(join(cwd, ".claude", "rules"), { recursive: true })
    await writeFile(join(cwd, ".claude", "rules", "src.md"), "---\npaths: [src/**]\n---\nUse source rules.")

    const result = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({
        runtimeParity: { cwd, scanClaudeMd: true, readWorkspaceFiles: true, activePaths: ["docs/readme.md"] },
      }),
      createRuntimeParityState(),
    )

    expect(result.text ?? "").not.toContain("Use source rules.")
    expect(result.gaps).toEqual([])
  })

  it("reports frontmatter paths without activePaths as a gap", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-frontmatter-gap-"))
    await mkdir(join(cwd, ".claude", "rules"), { recursive: true })
    await writeFile(join(cwd, ".claude", "rules", "src.md"), "---\npaths: [src/**]\n---\nUse source rules.")

    const result = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({ runtimeParity: { cwd, scanClaudeMd: true, readWorkspaceFiles: true } }),
      createRuntimeParityState(),
    )

    expect(result.gaps).toContainEqual({
      domain: "WorkspaceMemoryDomain",
      reason: "frontmatter paths require runtimeParity.activePaths",
      path: ".claude/rules/src.md",
    })
  })

  it("does not apply rule content with unsupported frontmatter keys", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-frontmatter-key-gap-"))
    await mkdir(join(cwd, ".claude", "rules"), { recursive: true })
    await writeFile(join(cwd, ".claude", "rules", "src.md"), "---\npaths: [src/**]\nowner: team\n---\nBody")

    const result = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({
        runtimeParity: { cwd, scanClaudeMd: true, readWorkspaceFiles: true, activePaths: ["src/index.ts"] },
      }),
      createRuntimeParityState(),
    )

    expect(result.gaps).toContainEqual({
      domain: "WorkspaceMemoryDomain",
      reason: "unsupported frontmatter key",
      path: ".claude/rules/src.md",
    })
    expect(result.text ?? "").not.toContain("Body")
  })

  it("does not apply rule content with unsupported frontmatter paths syntax", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-frontmatter-syntax-gap-"))
    await mkdir(join(cwd, ".claude", "rules"), { recursive: true })
    await writeFile(join(cwd, ".claude", "rules", "src.md"), "---\npaths: src/**\n---\nBody")

    const result = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({
        runtimeParity: { cwd, scanClaudeMd: true, readWorkspaceFiles: true, activePaths: ["src/index.ts"] },
      }),
      createRuntimeParityState(),
    )

    expect(result.gaps).toContainEqual({
      domain: "WorkspaceMemoryDomain",
      reason: "unsupported frontmatter paths syntax",
      path: ".claude/rules/src.md",
    })
    expect(result.text ?? "").not.toContain("Body")
  })

  it("does not apply rule content with unsafe frontmatter path patterns", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-frontmatter-escape-gap-"))
    await mkdir(join(cwd, ".claude", "rules"), { recursive: true })
    await writeFile(join(cwd, ".claude", "rules", "escape.md"), "---\npaths: [../secret/**]\n---\nBody")

    const result = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({
        runtimeParity: { cwd, scanClaudeMd: true, readWorkspaceFiles: true, activePaths: ["src/index.ts"] },
      }),
      createRuntimeParityState(),
    )

    expect(result.gaps).toContainEqual({
      domain: "WorkspaceMemoryDomain",
      reason: "frontmatter path resolves outside runtimeParity.cwd",
      path: ".claude/rules/escape.md",
    })
    expect(result.text ?? "").not.toContain("Body")
  })

  it("keeps cached workspace memory isolated by activePaths", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-memory-active-path-cache-"))
    await mkdir(join(cwd, ".claude", "rules"), { recursive: true })
    await writeFile(join(cwd, ".claude", "rules", "src.md"), "---\npaths: [src/**]\n---\nUse source rules.")
    const state = createRuntimeParityState()

    const srcResult = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({
        runtimeParity: { cwd, scanClaudeMd: true, readWorkspaceFiles: true, activePaths: ["src/index.ts"], cache: true },
      }),
      state,
    )
    const docsResult = await loadWorkspaceMemoryDomain(
      resolveBridgeOptions({
        runtimeParity: { cwd, scanClaudeMd: true, readWorkspaceFiles: true, activePaths: ["docs/readme.md"], cache: true },
      }),
      state,
    )

    expect(srcResult.text).toContain("Use source rules.")
    expect(docsResult.text ?? "").not.toContain("Use source rules.")
  })
})
