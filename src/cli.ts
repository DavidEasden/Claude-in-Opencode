import { readFileSync } from "node:fs"
import { Command } from "commander"
import { doctorConfig } from "./cli/doctor"
import { defaultGlobalConfigPath, initConfig, parseConfigText } from "./cli/init"
import { registerParityCommands } from "./cli/parity"
import { uninstallConfig } from "./cli/uninstall"

const program = new Command()

program
  .name("claude-in-opencode")
  .description("Install and inspect the Claude in OpenCode plugin")
  .version("0.1.0")

program
  .command("init")
  .description("Add claude-in-opencode to the global opencode config")
  .option("--path <path>", "Config path to modify")
  .action((options: { path?: string }) => {
    initConfig(options.path)
    console.log("claude-in-opencode configured. Restart opencode for the change to take effect.")
  })

program
  .command("doctor")
  .description("Check the Claude in OpenCode configuration")
  .option("--path <path>", "Config path to inspect")
  .action((options: { path?: string }) => {
    const path = options.path ?? defaultGlobalConfigPath()
    const cfg = parseConfigText(readFileSync(path, "utf8"), path)
    const result = doctorConfig(cfg)
    console.log(JSON.stringify(result, null, 2))
    if (result.problems.length > 0) process.exitCode = 1
  })

program
  .command("uninstall")
  .description("Remove claude-in-opencode from the opencode config")
  .option("--path <path>", "Config path to modify")
  .action((options: { path?: string }) => {
    uninstallConfig(options.path)
    console.log("claude-in-opencode removed. Restart opencode for the change to take effect.")
  })

registerParityCommands(program)

program.parse()
