import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"
import type { ExtensionRegistryEntry } from "@orbyt/contracts"
import { PluginAuthService } from "../plugins/plugin-auth-service.js"
import { PluginVault } from "../plugins/plugin-vault.js"

const tempDirs: string[] = []

const canvasEntry: Extract<ExtensionRegistryEntry, { kind: "available" }> = {
  kind: "available",
  manifest: {
    id: "canvas-mcp",
    name: "Canvas Assistant",
    description: "Canvas integration",
    version: "0.1.0",
    transport: {
      type: "local_stdio",
      entry: "dist/index.js",
    },
    permissions: ["canvas"],
    auth: {
      type: "manual_token",
      instructions: "Paste your Canvas base URL and token.",
      fields: [
        {
          key: "baseUrl",
          label: "Canvas base URL",
          type: "base_url",
          required: true,
          placeholder: "https://myschool.instructure.com",
        },
        {
          key: "token",
          label: "Canvas access token",
          type: "secret",
          required: true,
          placeholder: "Paste your Canvas access token",
        },
      ],
    },
    tools: [{ name: "list_courses", description: "List courses" }],
    author: "orbyt",
    homepage: "https://github.com/Orbyt/orbyt",
  },
  installSource: "bundled",
  status: "discovered",
  enabled: true,
}

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-plugin-auth-"))
  tempDirs.push(dir)
  return dir
}

function createRegistry(entry: ExtensionRegistryEntry = canvasEntry) {
  const pluginId = entry.kind === "available" ? entry.manifest.id : entry.pluginId
  return {
    getStatus: (candidatePluginId: string) => (candidatePluginId === pluginId ? entry : null),
    getAvailableRecord: (candidatePluginId: string) => {
      if (candidatePluginId !== pluginId || entry.kind !== "available") {
        return null
      }

      return {
        entry,
        manifestPath: `/tmp/${pluginId}/manifest.json`,
      }
    },
  }
}

function createVault(rootDir: string): PluginVault {
  return new PluginVault(rootDir, {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`enc:${value}`, "utf8"),
    decryptString: (value) => value.toString("utf8").replace(/^enc:/, ""),
  })
}

describe("PluginAuthService", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (dir) {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  test("reports not configured before any credentials are saved", () => {
    const authService = new PluginAuthService({
      registry: createRegistry(),
      vault: createVault(createTempDir()),
    })

    expect(authService.getStatus("canvas-mcp")).toEqual({
      pluginId: "canvas-mcp",
      status: "not_configured",
    })
  })

  test("saves credentials and returns a scoped runtime message", () => {
    const authService = new PluginAuthService({
      registry: createRegistry(),
      vault: createVault(createTempDir()),
    })

    const saveResult = authService.saveCredentials({
      pluginId: "canvas-mcp",
      values: {
        baseUrl: "https://myschool.instructure.com",
        token: "12345678901234567890",
      },
    })

    expect(saveResult).toEqual({
      ok: true,
      pluginId: "canvas-mcp",
      status: "configured",
    })
    expect(authService.getStatus("canvas-mcp")).toEqual({
      pluginId: "canvas-mcp",
      status: "configured",
      values: { baseUrl: "https://myschool.instructure.com" },
      hasValue: { baseUrl: true, token: true },
    })
    expect(authService.getCredentialMessage("canvas-mcp")).toEqual({
      type: "plugin.credentials",
      pluginId: "canvas-mcp",
      payload: {
        baseUrl: "https://myschool.instructure.com",
        token: "12345678901234567890",
      },
    })
  })

  test("rejects malformed credentials without writing them", () => {
    const authService = new PluginAuthService({
      registry: createRegistry(),
      vault: createVault(createTempDir()),
    })

    const result = authService.saveCredentials({
      pluginId: "canvas-mcp",
      values: {
        baseUrl: "http://example.com",
        token: "short",
      },
    })

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({
      pluginId: "canvas-mcp",
      reason: "validation_failed",
      fieldErrors: {
        baseUrl: "Enter a valid HTTPS Canvas URL.",
        token: "Enter at least 20 characters.",
      },
    })
    expect(authService.getStatus("canvas-mcp")).toEqual({
      pluginId: "canvas-mcp",
      status: "not_configured",
    })
  })

  test("accepts Canvas deployments on custom HTTPS domains", () => {
    const authService = new PluginAuthService({
      registry: createRegistry(),
      vault: createVault(createTempDir()),
    })

    const result = authService.saveCredentials({
      pluginId: "canvas-mcp",
      values: {
        baseUrl: "https://canvas.socccd.edu/",
        token: "12345678901234567890",
      },
    })

    expect(result).toEqual({
      ok: true,
      pluginId: "canvas-mcp",
      status: "configured",
    })
  })
})
