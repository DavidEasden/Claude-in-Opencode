import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { resolveBridgeOptions } from "../../src/config"
import { extractAttachmentMentions, formatAttachmentMessage, loadAttachmentDomain } from "../../src/runtime/attachments"

describe("AttachmentDomain parser", () => {
  it("extracts unquoted, double-quoted, and single-quoted user @file mentions", () => {
    const result = extractAttachmentMentions({
      messages: [
        { role: "assistant", content: "ignore @assistant.txt" },
        {
          role: "user",
          content: [
            { type: "text", text: "read @src/a.ts and @\"docs/with spaces.md\" plus @'notes/today.md'" },
            { type: "tool_result", content: "ignore @tool.txt" },
          ],
        },
      ],
    })

    expect(result.gaps).toEqual([])
    expect(result.mentions).toEqual([
      { raw: "src/a.ts", path: "src/a.ts" },
      { raw: "docs/with spaces.md", path: "docs/with spaces.md" },
      { raw: "notes/today.md", path: "notes/today.md" },
    ])
  })

  it("normalizes #L and colon line ranges", () => {
    const result = extractAttachmentMentions({
      messages: [{ role: "user", content: "read @src/a.ts#L2-4 @src/b.ts:7 @src/c.ts:8-9" }],
    })

    expect(result.gaps).toEqual([])
    expect(result.mentions).toEqual([
      { raw: "src/a.ts#L2-4", path: "src/a.ts", lineStart: 2, lineEnd: 4 },
      { raw: "src/b.ts:7", path: "src/b.ts", lineStart: 7, lineEnd: 7 },
      { raw: "src/c.ts:8-9", path: "src/c.ts", lineStart: 8, lineEnd: 9 },
    ])
  })

  it("deduplicates mentions and ignores quoted agent mentions", () => {
    const result = extractAttachmentMentions({
      messages: [{ role: "user", content: "read @src/a.ts and @src/a.ts and @\"code-reviewer (agent)\"" }],
    })

    expect(result.gaps).toEqual([])
    expect(result.mentions).toEqual([{ raw: "src/a.ts", path: "src/a.ts" }])
  })

  it("reports invalid line ranges", () => {
    const result = extractAttachmentMentions({
      messages: [{ role: "user", content: "read @src/a.ts#L0 @src/b.ts:8-3" }],
    })

    expect(result.mentions).toEqual([])
    expect(result.gaps).toEqual([
      { domain: "AttachmentDomain", reason: "invalid @file line range", path: "src/a.ts#L0" },
      { domain: "AttachmentDomain", reason: "invalid @file line range", path: "src/b.ts:8-3" },
    ])
  })

  it("redacts absolute paths in invalid line range gaps", () => {
    const result = extractAttachmentMentions({
      messages: [{ role: "user", content: "read @/Users/alice/project/file.ts#L0" }],
    })

    expect(result.mentions).toEqual([])
    expect(result.gaps).toEqual([
      { domain: "AttachmentDomain", reason: "invalid @file line range", path: "<absolute-path>" },
    ])
  })

  it("reports hash line ranges with missing end line as invalid", () => {
    const result = extractAttachmentMentions({
      messages: [{ role: "user", content: "read @src/a.ts#L2-" }],
    })

    expect(result.mentions).toEqual([])
    expect(result.gaps).toEqual([
      { domain: "AttachmentDomain", reason: "invalid @file line range", path: "src/a.ts#L2-" },
    ])
  })

  it("reports colon line ranges with missing end line as invalid", () => {
    const result = extractAttachmentMentions({
      messages: [{ role: "user", content: "read @src/a.ts:2-" }],
    })

    expect(result.mentions).toEqual([])
    expect(result.gaps).toEqual([
      { domain: "AttachmentDomain", reason: "invalid @file line range", path: "src/a.ts:2-" },
    ])
  })

  it("redacts absolute paths in malformed colon range gaps", () => {
    const result = extractAttachmentMentions({
      messages: [{ role: "user", content: "read @/Users/alice/project/file.ts:2-" }],
    })

    expect(result.mentions).toEqual([])
    expect(result.gaps).toEqual([
      { domain: "AttachmentDomain", reason: "invalid @file line range", path: "<absolute-path>" },
    ])
  })
})

describe("AttachmentDomain formatter", () => {
  it("formats bridge-generated pre-read messages with relative path, range, and content", () => {
    expect(formatAttachmentMessage({ relativePath: "src/a.ts", lineStart: 2, lineEnd: 3, text: "two\nthree" })).toBe(
      ["Bridge-generated automatic @file pre-read for src/a.ts:2-3", "", "two\nthree"].join("\n"),
    )
  })
})

describe("AttachmentDomain automatic reads", () => {
  it("reads text @file mentions when all gates are enabled", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-attachments-"))
    await mkdir(join(cwd, "src"), { recursive: true })
    await writeFile(join(cwd, "src", "a.ts"), "export const value = 1\n")

    const result = await loadAttachmentDomain(
      { messages: [{ role: "user", content: "read @src/a.ts" }] },
      resolveBridgeOptions({ runtimeParity: { cwd, preReadFiles: true, readWorkspaceFiles: true } }),
    )

    expect(result.gaps).toEqual([])
    expect(result.insertedMessages).toEqual([
      { role: "system", content: "Bridge-generated automatic @file pre-read for src/a.ts\n\nexport const value = 1\n" },
    ])
    expect(result.stateUsed).toEqual([
      { domain: "AttachmentDomain", source: "runtimeParity.cwd", detail: "src/a.ts" },
    ])
  })

  it("selects inclusive line ranges", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-attachments-lines-"))
    await mkdir(join(cwd, "src"), { recursive: true })
    await writeFile(join(cwd, "src", "a.ts"), "one\ntwo\nthree\nfour\n")

    const result = await loadAttachmentDomain(
      { messages: [{ role: "user", content: "read @src/a.ts#L2-3" }] },
      resolveBridgeOptions({ runtimeParity: { cwd, preReadFiles: true, readWorkspaceFiles: true } }),
    )

    expect(result.gaps).toEqual([])
    expect(result.insertedMessages[0]?.content).toBe("Bridge-generated automatic @file pre-read for src/a.ts:2-3\n\ntwo\nthree")
    expect(result.stateUsed).toEqual([
      { domain: "AttachmentDomain", source: "runtimeParity.cwd", detail: "src/a.ts:2-3" },
    ])
  })

  it("reports gaps for missing, directory, binary, unsupported extension, and EOF ranges", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-attachments-gaps-"))
    await mkdir(join(cwd, "docs"), { recursive: true })
    await writeFile(join(cwd, "binary.bin"), Buffer.from([0x00, 0x01, 0x02]))
    await writeFile(join(cwd, "doc.pdf"), "%PDF-1.7")
    await writeFile(join(cwd, "short.txt"), "one\n")

    const result = await loadAttachmentDomain(
      { messages: [{ role: "user", content: "read @missing.txt @docs @binary.bin @doc.pdf @short.txt#L4" }] },
      resolveBridgeOptions({ runtimeParity: { cwd, preReadFiles: true, readWorkspaceFiles: true } }),
    )

    expect(result.insertedMessages).toEqual([])
    expect(result.gaps).toEqual([
      { domain: "AttachmentDomain", reason: "file is unreadable or missing", path: "missing.txt" },
      { domain: "AttachmentDomain", reason: "path is not a file", path: "docs" },
      { domain: "AttachmentDomain", reason: "file is not valid workspace text", path: "binary.bin" },
      { domain: "AttachmentDomain", reason: "unsupported @file type", path: "doc.pdf" },
      { domain: "AttachmentDomain", reason: "line range starts after end of file", path: "short.txt#L4" },
    ])
  })

  it("reports invalid UTF-8 @file mentions as AttachmentDomain gaps", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-attachments-utf8-"))
    await writeFile(join(cwd, "invalid.txt"), Buffer.from([0x66, 0x6f, 0xc3, 0x28]))

    const result = await loadAttachmentDomain(
      { messages: [{ role: "user", content: "read @invalid.txt" }] },
      resolveBridgeOptions({ runtimeParity: { cwd, preReadFiles: true, readWorkspaceFiles: true } }),
    )

    expect(result.insertedMessages).toEqual([])
    expect(result.stateUsed).toEqual([])
    expect(result.gaps).toEqual([
      { domain: "AttachmentDomain", reason: "file is not valid workspace text", path: "invalid.txt" },
    ])
  })

  it("reports SVG @file mentions as unsupported attachment types", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-attachments-svg-"))
    await writeFile(join(cwd, "diagram.svg"), "<svg><text>do not read</text></svg>")

    const result = await loadAttachmentDomain(
      { messages: [{ role: "user", content: "read @diagram.svg" }] },
      resolveBridgeOptions({ runtimeParity: { cwd, preReadFiles: true, readWorkspaceFiles: true } }),
    )

    expect(result.insertedMessages).toEqual([])
    expect(result.stateUsed).toEqual([])
    expect(result.gaps).toEqual([{ domain: "AttachmentDomain", reason: "unsupported @file type", path: "diagram.svg" }])
  })

  it("reports EOF range gaps with cwd-relative paths for absolute file mentions", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-attachments-absolute-range-"))
    const cwdReal = await realpath(cwd)
    const filePath = join(cwdReal, "short.txt")
    await writeFile(filePath, "one\n")

    const result = await loadAttachmentDomain(
      { messages: [{ role: "user", content: `read @${filePath}#L4` }] },
      resolveBridgeOptions({ runtimeParity: { cwd, preReadFiles: true, readWorkspaceFiles: true } }),
    )

    expect(result.insertedMessages).toEqual([])
    expect(result.gaps).toEqual([
      { domain: "AttachmentDomain", reason: "line range starts after end of file", path: "short.txt#L4" },
    ])
    expect(result.gaps[0]?.path).not.toContain(cwd)
  })

  it("does not auto-read files when explicit preReadMessages replay is present", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "bridge-attachments-replay-"))
    await writeFile(join(cwd, "sample.txt"), "disk content")

    const result = await loadAttachmentDomain(
      { messages: [{ role: "user", content: "read @sample.txt" }] },
      resolveBridgeOptions({
        runtimeParity: {
          cwd,
          preReadFiles: true,
          readWorkspaceFiles: true,
          preReadMessages: ["Called the Read tool with captured fixture output"],
        },
      }),
    )

    expect(result).toEqual({ insertedMessages: [], stateUsed: [], gaps: [] })
  })
})
