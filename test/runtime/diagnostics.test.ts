import { describe, expect, it } from "vitest"
import { formatRuntimeGaps, formatRuntimeParityGate, formatRuntimeStateEvidence } from "../../src/runtime/diagnostics"

describe("runtime diagnostics", () => {
  it("formats runtime domain gaps", () => {
    expect(
      formatRuntimeGaps([
        { domain: "WorkspaceMemoryDomain", reason: ".claude/rules frontmatter paths unsupported" },
        { domain: "AttachmentDomain", reason: "PDF @file reference unsupported", path: "docs/file.pdf" },
      ]),
    ).toBe([
      "Parity gaps:",
      "- WorkspaceMemoryDomain: .claude/rules frontmatter paths unsupported",
      "- AttachmentDomain: PDF @file reference unsupported (docs/file.pdf)",
    ].join("\n"))
  })

  it("prints no gaps when none are present", () => {
    expect(formatRuntimeGaps([])).toBe("No runtime parity gaps.")
  })
})

describe("runtime state evidence diagnostics", () => {
  it("formats runtime state evidence", () => {
    expect(
      formatRuntimeStateEvidence([
        { domain: "AttachmentDomain", source: "runtimeParity.preReadMessages", detail: "1 message(s)" },
        { domain: "McpDomain", source: "opencode request tools/runtimeParity.mcpTools" },
      ]),
    ).toBe([
      "Runtime state used:",
      "- AttachmentDomain: runtimeParity.preReadMessages - 1 message(s)",
      "- McpDomain: opencode request tools/runtimeParity.mcpTools",
    ].join("\n"))
  })

  it("formats no runtime state evidence", () => {
    expect(formatRuntimeStateEvidence([])).toBe("No runtime state evidence.")
  })

  it("formats a passing runtime parity gate", () => {
    expect(formatRuntimeParityGate({ equivalent: true, diffCount: 0, gapCount: 0, reasons: [] })).toBe(
      "Runtime parity gate: equivalent.",
    )
  })

  it("formats a failing runtime parity gate", () => {
    expect(
      formatRuntimeParityGate({
        equivalent: false,
        diffCount: 2,
        gapCount: 1,
        reasons: ["normalized request diff has 2 difference(s)", "runtime context has 1 gap(s)"],
      }),
    ).toBe([
      "Runtime parity gate: not equivalent.",
      "- normalized request diff has 2 difference(s)",
      "- runtime context has 1 gap(s)",
    ].join("\n"))
  })
})
