import { describe, expect, test } from "bun:test"
import { createNodeSqliteVersionError, supportsNodeSqliteRuntimeVersion } from "../db/runtime-sqlite.js"

describe("runtime sqlite support", () => {
  test("accepts supported Node runtime versions for packaged Electron", () => {
    expect(supportsNodeSqliteRuntimeVersion("24.11.0")).toBe(true)
    expect(supportsNodeSqliteRuntimeVersion("23.11.0")).toBe(true)
    expect(supportsNodeSqliteRuntimeVersion("22.16.0")).toBe(true)
  })

  test("rejects Node runtimes that lack the required node:sqlite APIs", () => {
    expect(supportsNodeSqliteRuntimeVersion("23.10.0")).toBe(false)
    expect(supportsNodeSqliteRuntimeVersion("22.15.0")).toBe(false)
    expect(createNodeSqliteVersionError("22.15.0").message).toContain("node:sqlite support")
  })
})
