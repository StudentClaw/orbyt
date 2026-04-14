import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"
import { PluginVault } from "../plugins/plugin-vault.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "student-claw-plugin-vault-"))
  tempDirs.push(dir)
  return dir
}

describe("PluginVault", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (dir) {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  test("round-trips encrypted credentials for one plugin record", () => {
    const rootDir = createTempDir()
    const vault = new PluginVault(rootDir, {
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(`enc:${value}`, "utf8"),
      decryptString: (value) => value.toString("utf8").replace(/^enc:/, ""),
    })

    vault.write("canvas-mcp", {
      baseUrl: "https://myschool.instructure.com",
      token: "12345678901234567890",
    })

    expect(vault.read("canvas-mcp")).toEqual({
      baseUrl: "https://myschool.instructure.com",
      token: "12345678901234567890",
    })
  })

  test("throws for malformed stored records", () => {
    const rootDir = createTempDir()
    writeFileSync(path.join(rootDir, "canvas-mcp.json"), JSON.stringify({
      pluginId: "canvas-mcp",
      encryptedPayload: Buffer.from(JSON.stringify({ baseUrl: 42 }), "utf8").toString("base64"),
      updatedAt: "2026-04-11T00:00:00.000Z",
    }), "utf8")

    const vault = new PluginVault(rootDir, {
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(value, "utf8"),
      decryptString: (value) => value.toString("utf8"),
    })

    expect(() => vault.read("canvas-mcp")).toThrow("Stored credentials are invalid")
  })
})
