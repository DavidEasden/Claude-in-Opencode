import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Command } from "commander"
import { describe, expect, it, vi } from "vitest"
import { registerParityCommands } from "../src/cli/parity"

function program() {
  const command = new Command()
  command.exitOverride()
  registerParityCommands(command)
  return command
}

describe("parity CLI", () => {
  it("sanitizes a fixture file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bridge-parity-cli-"))
    const input = join(dir, "input.json")
    const output = join(dir, "output.json")
    await writeFile(
      input,
      JSON.stringify({
        version: "2.1.205-capture",
        scenario: { name: "cli", description: "cli" },
        runtimeInput: {},
        expected: {
          method: "POST",
          urlKind: "anthropic-messages",
          headers: { "x-api-key": "sk-ant-secret" },
          body: {},
        },
        redactions: [],
      }),
    )

    await program().parseAsync(["node", "test", "parity", "sanitize", "--input", input, "--output", output])

    expect(await readFile(output, "utf8")).toContain("$API_KEY_REDACTED")
  })

  it("prints fixture diff output", async () => {
    const previousExitCode = process.exitCode
    process.exitCode = undefined
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    try {
      const dir = await mkdtemp(join(tmpdir(), "bridge-parity-diff-"))
      const fixture = join(dir, "fixture.json")
      const opencode = join(dir, "opencode.json")
      await writeFile(
        fixture,
        JSON.stringify({
          version: "2.1.205-capture",
          scenario: { name: "cli", description: "cli" },
          runtimeInput: {},
          expected: {
            method: "POST",
            urlKind: "anthropic-messages",
            headers: {
              authorization: "Bearer sk-ant-authorization",
              "x-api-key": "sk-ant-key",
              "x-claude-code-session-id": "ses_cli_secret",
            },
            body: {
              model: "wrong",
              metadata: { user_id: JSON.stringify({ device_id: "dev-cli-secret", account_uuid: "acc-cli-secret" }) },
            },
          },
          redactions: [],
        }),
      )
      await writeFile(opencode, JSON.stringify({ messages: [] }))

      await program().parseAsync(["node", "test", "parity", "diff", "--fixture", fixture, "--input", opencode])

      const output = log.mock.calls.join("\n")
      expect(output).toContain("body.model changed")
      expect(process.exitCode).toBe(1)
      expect(output).not.toContain("sk-ant-authorization")
      expect(output).not.toContain("sk-ant-key")
      expect(output).not.toContain("ses_cli_secret")
      expect(output).not.toContain("dev-cli-secret")
      expect(output).not.toContain("acc-cli-secret")
    } finally {
      process.exitCode = previousExitCode
      log.mockRestore()
    }
  })

  it("prints runtime diagnostics when parity diff uses runtime mode", async () => {
    const previousExitCode = process.exitCode
    process.exitCode = undefined
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)
    try {
      const dir = await mkdtemp(join(tmpdir(), "bridge-parity-runtime-diff-"))
      const fixture = join(dir, "fixture.json")
      const opencode = join(dir, "opencode.json")
      await writeFile(
        fixture,
        JSON.stringify({
          version: "2.1.205-capture",
          scenario: { name: "runtime-cli", description: "runtime cli" },
          runtimeInput: {},
          expected: {
            method: "POST",
            urlKind: "anthropic-messages",
            headers: {},
            body: {},
          },
          redactions: [],
        }),
      )
      await writeFile(opencode, JSON.stringify({ messages: [] }))

      await program().parseAsync(["node", "test", "parity", "diff", "--runtime", "--fixture", fixture, "--input", opencode])

      const output = log.mock.calls.join("\n")
      expect(output).toContain("Runtime parity gate: not equivalent.")
      expect(output).toContain("No runtime parity gaps.")
      expect(output).toContain("No runtime state evidence.")
      expect(process.exitCode).toBe(1)
    } finally {
      process.exitCode = previousExitCode
      log.mockRestore()
    }
  })
})
