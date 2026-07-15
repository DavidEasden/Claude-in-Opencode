import { readFile } from "node:fs/promises"
import type { Command } from "commander"
import { compareBridgeToFixture, compareBridgeToFixtureWithRuntime } from "../parity/bridge"
import { formatDiffResult } from "../parity/diff"
import { readParityFixture, sanitizeFixture, writeParityFixture } from "../parity/fixtures"
import { formatRuntimeGaps, formatRuntimeParityGate, formatRuntimeStateEvidence } from "../runtime/diagnostics"

export function registerParityCommands(program: Command): void {
  const parity = program.command("parity").description("Development-only Claude Code parity diagnostics")

  parity
    .command("sanitize")
    .requiredOption("--input <path>", "Raw fixture JSON to sanitize")
    .requiredOption("--output <path>", "Sanitized fixture output path")
    .action(async (options: { input: string; output: string }) => {
      const fixture = await readParityFixture(options.input)
      await writeParityFixture(options.output, sanitizeFixture(fixture))
      console.log(`Wrote sanitized fixture to ${options.output}`)
    })

  parity
    .command("diff")
    .requiredOption("--fixture <path>", "Sanitized parity fixture")
    .requiredOption("--input <path>", "OpenCode request body JSON")
    .option("--runtime", "Include runtime context gaps and parity gate diagnostics")
    .action(async (options: { fixture: string; input: string; runtime?: boolean }) => {
      const fixture = await readParityFixture(options.fixture)
      const input = JSON.parse(await readFile(options.input, "utf8")) as unknown
      if (options.runtime) {
        const result = await compareBridgeToFixtureWithRuntime(input, fixture)
        console.log(formatDiffResult(result.diff))
        console.log(formatRuntimeParityGate(result.gate))
        console.log(formatRuntimeGaps(result.runtimeContext.gaps))
        console.log(formatRuntimeStateEvidence(result.runtimeContext.stateUsed))
        if (!result.gate.equivalent) process.exitCode = 1
        return
      }

      const result = compareBridgeToFixture(input, fixture)
      console.log(formatDiffResult(result.diff))
      if (!result.diff.equal) process.exitCode = 1
    })
}
