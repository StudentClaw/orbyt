import { describe, test, expect } from "bun:test"

describe("Server lifecycle", () => {
  test("ServerProcess interface is well-defined", async () => {
    // Type-level test: ensure the module loads
    const { spawnServer } = await import("../server/lifecycle.js")
    expect(typeof spawnServer).toBe("function")
  })
})
