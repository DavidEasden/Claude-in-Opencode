import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { join } from "node:path"

describe("package structure", () => {
  it("does not ship a default local HTTP server", () => {
    const root = process.cwd()

    expect(existsSync(join(root, "src", "server.ts"))).toBe(false)
    expect(existsSync(join(root, "src", "bridge", "server.ts"))).toBe(false)
  })
})
