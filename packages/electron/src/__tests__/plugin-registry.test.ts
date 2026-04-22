import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"
import {
  PluginRegistry,
  resolveBundledCatalogDir,
  resolveUserExtensionStoreDir,
} from "../plugins/plugin-registry.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "student-claw-plugin-registry-"))
  tempDirs.push(dir)
  return dir
}

function writeManifest(rootDir: string, folderName: string, manifest: object | string): string {
  const extensionDir = path.join(rootDir, folderName)
  mkdirSync(extensionDir, { recursive: true })
  const manifestPath = path.join(extensionDir, "manifest.json")
  writeFileSync(
    manifestPath,
    typeof manifest === "string" ? manifest : JSON.stringify(manifest, null, 2),
    "utf8",
  )
  return manifestPath
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe("PluginRegistry", () => {
  test("hides Apple Calendar from registry listings on non-macOS while leaving other bundled plugins visible", () => {
    const bundledDir = createTempDir()
    const userDir = createTempDir()

    writeManifest(bundledDir, "apple-calendar-mcp", {
      id: "apple-calendar-mcp",
      name: "Apple Calendar",
      description: "Local Apple Calendar integration",
      version: "1.0.0",
      transport: {
        type: "local_stdio",
        entry: "dist/index.js",
      },
      permissions: ["local_os.calendar.read", "local_os.calendar.write"],
      auth: {
        type: "none",
      },
      tools: [
        { name: "getCalendars", description: "List calendars" },
      ],
      author: "student-claw",
      homepage: "https://github.com/StudentClaw/student-claw",
    })
    writeManifest(bundledDir, "canvas-mcp", {
      id: "canvas-mcp",
      name: "Canvas Assistant",
      description: "Canvas integration",
      version: "0.1.0",
      transport: {
        type: "local_stdio",
        entry: "dist/index.js",
      },
      permissions: ["canvas.read"],
      auth: {
        type: "none",
      },
      tools: [
        { name: "list_courses", description: "List courses" },
      ],
      author: "student-claw",
      homepage: "https://github.com/StudentClaw/student-claw",
    })

    const registry = new PluginRegistry({
      bundledCatalogDir: bundledDir,
      userExtensionStoreDir: userDir,
      availability: {
        platform: "linux",
      },
    })

    const availableIds = registry.list()
      .filter((entry) => entry.kind === "available")
      .map((entry) => entry.manifest.id)

    expect(availableIds).toEqual(["canvas-mcp"])
    expect(registry.getStatus("apple-calendar-mcp")).toMatchObject({
      kind: "available",
      manifest: {
        id: "apple-calendar-mcp",
      },
    })
  })

  test("hides Apple Calendar on unsupported macOS versions while leaving other bundled plugins visible", () => {
    const bundledDir = createTempDir()
    const userDir = createTempDir()

    writeManifest(bundledDir, "apple-calendar-mcp", {
      id: "apple-calendar-mcp",
      name: "Apple Calendar",
      description: "Local Apple Calendar integration",
      version: "1.0.0",
      transport: {
        type: "local_stdio",
        entry: "dist/index.js",
      },
      permissions: ["local_os.calendar.read", "local_os.calendar.write"],
      auth: {
        type: "none",
      },
      tools: [
        { name: "getCalendars", description: "List calendars" },
      ],
      author: "student-claw",
      homepage: "https://github.com/StudentClaw/student-claw",
    })
    writeManifest(bundledDir, "canvas-mcp", {
      id: "canvas-mcp",
      name: "Canvas Assistant",
      description: "Canvas integration",
      version: "0.1.0",
      transport: {
        type: "local_stdio",
        entry: "dist/index.js",
      },
      permissions: ["canvas.read"],
      auth: {
        type: "none",
      },
      tools: [
        { name: "list_courses", description: "List courses" },
      ],
      author: "student-claw",
      homepage: "https://github.com/StudentClaw/student-claw",
    })

    const registry = new PluginRegistry({
      bundledCatalogDir: bundledDir,
      userExtensionStoreDir: userDir,
      availability: {
        platform: "darwin",
        systemVersion: "12.6.9",
      },
    })

    const availableIds = registry.list()
      .filter((entry) => entry.kind === "available")
      .map((entry) => entry.manifest.id)

    expect(availableIds).toEqual(["canvas-mcp"])
    expect(registry.getAvailableRecord("apple-calendar-mcp")).toMatchObject({
      entry: {
        manifest: {
          id: "apple-calendar-mcp",
        },
      },
    })
  })

  test("discovers Apple Calendar in the real bundled catalog", () => {
    const repoRoot = path.resolve(import.meta.dir, "../../../..")
    const repoBundledDir = path.join(repoRoot, "packages/extensions")
    const registry = new PluginRegistry({
      bundledCatalogDir: repoBundledDir,
      userExtensionStoreDir: createTempDir(),
    })

    const entries = registry.list()
    const appleEntry = entries.find((entry) => entry.kind === "available" && entry.manifest.id === "apple-calendar-mcp")

    expect(appleEntry).toMatchObject({
      kind: "available",
      installSource: "bundled",
      status: "discovered",
      enabled: true,
    })
  })

  test("lists valid bundled and user manifests as available entries", () => {
    const bundledDir = createTempDir()
    const userDir = createTempDir()

    writeManifest(bundledDir, "canvas-mcp", {
      id: "canvas-mcp",
      name: "Canvas Assistant",
      description: "Canvas integration",
      version: "0.1.0",
      transport: {
        type: "local_stdio",
        entry: "dist/index.js",
      },
      permissions: ["read"],
      auth: {
        type: "none",
      },
      tools: [
        { name: "list_courses", description: "List courses" },
      ],
      author: "student-claw",
      homepage: "https://github.com/StudentClaw/student-claw",
    })
    writeManifest(userDir, "notes-mcp", {
      id: "notes-mcp",
      name: "Notes MCP",
      description: "User extension",
      version: "0.2.0",
      transport: {
        type: "local_stdio",
        entry: "dist/index.js",
      },
      permissions: ["notes"],
      auth: {
        type: "none",
      },
      tools: [
        { name: "list_notes", description: "List notes" },
      ],
      author: "student-claw",
      homepage: "https://github.com/StudentClaw/student-claw",
    })

    const registry = new PluginRegistry({
      bundledCatalogDir: bundledDir,
      userExtensionStoreDir: userDir,
    })

    const entries = registry.list()
    expect(entries).toHaveLength(2)
    expect(entries.map((entry) => entry.installSource)).toEqual(["bundled", "user"])
    expect(entries.every((entry) => entry.kind === "available")).toBe(true)
    expect(entries[0]?.kind === "available" ? entries[0].manifest.id : null).toBe("canvas-mcp")
    expect(entries[1]?.kind === "available" ? entries[1].manifest.id : null).toBe("notes-mcp")
  })

  test("records invalid manifests without throwing", () => {
    const bundledDir = createTempDir()
    const userDir = createTempDir()
    const manifestPath = writeManifest(bundledDir, "broken-mcp", {
      id: "broken-mcp",
      name: "Broken MCP",
      description: "Missing transport entry",
      version: "0.1.0",
      transport: {
        type: "local_stdio",
      },
      permissions: [],
      auth: {
        type: "none",
      },
      tools: [],
      author: "student-claw",
      homepage: "https://github.com/StudentClaw/student-claw",
    })

    const registry = new PluginRegistry({
      bundledCatalogDir: bundledDir,
      userExtensionStoreDir: userDir,
    })

    const entries = registry.list()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      kind: "invalid",
      pluginId: "broken-mcp",
      displayName: "Broken MCP",
      installSource: "bundled",
      status: "error",
      enabled: false,
      manifestPath,
    })
  })

  test("returns one entry by plugin id", () => {
    const bundledDir = createTempDir()
    const userDir = createTempDir()

    writeManifest(bundledDir, "template-mcp", {
      id: "template-mcp",
      name: "Template MCP",
      description: "Template extension",
      version: "0.1.0",
      transport: {
        type: "local_stdio",
        entry: "dist/index.js",
      },
      permissions: ["template"],
      auth: {
        type: "none",
      },
      tools: [
        { name: "template_ping", description: "Ping" },
      ],
      author: "student-claw",
      homepage: "https://github.com/StudentClaw/student-claw",
    })

    const registry = new PluginRegistry({
      bundledCatalogDir: bundledDir,
      userExtensionStoreDir: userDir,
    })

    const entry = registry.getStatus("template-mcp")
    expect(entry?.kind).toBe("available")
    if (entry?.kind === "available") {
      expect(entry.manifest.name).toBe("Template MCP")
    }
  })

  test("resolves helper paths for dev and user extension stores", () => {
    const currentDir = "/repo/packages/electron/dist/main/ipc"
    expect(resolveBundledCatalogDir(currentDir, false)).toBe("/repo/packages/extensions")
    expect(resolveBundledCatalogDir(currentDir, true, "/app/resources")).toBe("/app/resources/extensions")
    expect(resolveUserExtensionStoreDir("/Users/paul/Library/Application Support/Student Claw"))
      .toBe("/Users/paul/Library/Application Support/Student Claw/extensions")
  })
})
