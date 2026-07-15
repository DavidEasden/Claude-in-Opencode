import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..")

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>
}

describe("package identity", () => {
  it("uses the Claude in OpenCode package and CLI names", () => {
    const packageJson = readJson(join(packageRoot, "package.json"))
    const packageLock = readJson(join(packageRoot, "package-lock.json"))

    expect(packageJson).toMatchObject({
      name: "claude-in-opencode",
      description: "Claude in OpenCode plugin that rewrites Anthropic requests into Claude Code-like requests through an in-process fetch bridge",
      bin: { "claude-in-opencode": "dist/cli.js" },
    })
    expect(packageLock).toMatchObject({
      name: "claude-in-opencode",
      packages: {
        "": {
          name: "claude-in-opencode",
          bin: { "claude-in-opencode": "dist/cli.js" },
        },
      },
    })
  })

  it("declares the package license", () => {
    const packageJson = readJson(join(packageRoot, "package.json"))
    const packageLock = readJson(join(packageRoot, "package-lock.json")) as {
      packages: Record<string, Record<string, unknown>>
    }
    const licensePath = join(packageRoot, "LICENSE")

    expect(packageJson.license).toBe("AGPL-3.0-only")
    expect(packageLock.packages[""].license).toBe("AGPL-3.0-only")
    expect(existsSync(licensePath)).toBe(true)
    expect(readFileSync(licensePath, "utf8")).toContain(
      "GNU AFFERO GENERAL PUBLIC LICENSE",
    )
  })
})
