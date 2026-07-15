import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("MCP ownership boundary", () => {
  it("keeps MCP transports and configuration outside the bridge runtime", async () => {
    const source = await readFile(new URL("../../src/runtime/mcp.ts", import.meta.url), "utf8")
    const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const dependencies = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) }

    expect(source).not.toMatch(/node:child_process|node:fs|\.mcp\.json|fetch\s*\(/u)
    expect(Object.keys(dependencies).some((name) => name.startsWith("@modelcontextprotocol/"))).toBe(false)
  })
})
