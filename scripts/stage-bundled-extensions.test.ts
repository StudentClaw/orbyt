import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { PluginRegistry } from "../packages/electron/src/plugins/plugin-registry.js"
import { stageBundledExtensions } from "./stage-bundled-extensions"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "student-claw-stage-bundled-"))
  tempDirs.push(dir)
  return dir
}

function writeRuntimeExtension(rootDir: string, pluginId: string): string {
  const extensionDir = path.join(rootDir, pluginId)
  mkdirSync(path.join(extensionDir, "dist"), { recursive: true })
  mkdirSync(path.join(extensionDir, "src"), { recursive: true })
  writeFileSync(path.join(extensionDir, "manifest.json"), JSON.stringify({
    id: pluginId,
    name: pluginId,
    description: `${pluginId} extension`,
    version: "1.0.0",
    transport: {
      type: "local_stdio",
      entry: "dist/index.js",
    },
    permissions: ["test.permission"],
    auth: {
      type: "none",
    },
    tools: [{ name: `${pluginId}_ping`, description: "Ping" }],
    author: "student-claw",
    homepage: "https://github.com/StudentClaw/student-claw",
  }, null, 2))
  writeFileSync(path.join(extensionDir, "dist", "index.js"), `console.log("${pluginId}")\n`)
  writeFileSync(path.join(extensionDir, "dist", "server.test.js"), `console.log("${pluginId}-test")\n`)
  writeFileSync(path.join(extensionDir, "src", "index.ts"), "export {}\n")
  writeFileSync(path.join(extensionDir, "README.md"), `# ${pluginId}\n`)
  return extensionDir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe("stageBundledExtensions", () => {
  test("copies only the runtime subset for bundled extensions", () => {
    const repoRoot = createTempDir()
    const extensionsRoot = path.join(repoRoot, "packages", "extensions")
    const outputRoot = path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions")
    writeRuntimeExtension(extensionsRoot, "template-mcp")

    const stagedPluginIds = stageBundledExtensions({ extensionsRoot, outputRoot })

    expect(stagedPluginIds).toEqual(["template-mcp"])
    expect(existsSync(path.join(outputRoot, "template-mcp", "manifest.json"))).toBe(true)
    expect(existsSync(path.join(outputRoot, "template-mcp", "dist", "index.js"))).toBe(true)
    expect(existsSync(path.join(outputRoot, "template-mcp", "dist", "server.test.js"))).toBe(false)
    expect(existsSync(path.join(outputRoot, "template-mcp", "src"))).toBe(false)
    expect(existsSync(path.join(outputRoot, "template-mcp", "README.md"))).toBe(false)
  })

  test("prefers the direct Apple bridge release binary before architecture-specific outputs", () => {
    const repoRoot = createTempDir()
    const extensionsRoot = path.join(repoRoot, "packages", "extensions")
    const outputRoot = path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions")
    const extensionDir = writeRuntimeExtension(extensionsRoot, "apple-calendar-mcp")
    const directReleaseDir = path.join(extensionDir, "bridge", ".build", "release")
    const archReleaseDir = path.join(extensionDir, "bridge", ".build", "arm64-apple-macosx", "release")
    mkdirSync(directReleaseDir, { recursive: true })
    mkdirSync(archReleaseDir, { recursive: true })
    writeFileSync(path.join(directReleaseDir, "CalendarAPIBridge"), "direct-release")
    writeFileSync(path.join(archReleaseDir, "CalendarAPIBridge"), "arch-release")

    stageBundledExtensions({ extensionsRoot, outputRoot })

    expect(readFileSync(path.join(outputRoot, "apple-calendar-mcp", "bridge", "CalendarAPIBridge"), "utf8"))
      .toBe("direct-release")
  })

  test("falls back to an architecture-specific Apple bridge binary when needed", () => {
    const repoRoot = createTempDir()
    const extensionsRoot = path.join(repoRoot, "packages", "extensions")
    const outputRoot = path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions")
    const extensionDir = writeRuntimeExtension(extensionsRoot, "apple-calendar-mcp")
    const archReleaseDir = path.join(extensionDir, "bridge", ".build", "arm64-apple-macosx", "release")
    mkdirSync(archReleaseDir, { recursive: true })
    writeFileSync(path.join(archReleaseDir, "CalendarAPIBridge"), "arch-release")

    stageBundledExtensions({ extensionsRoot, outputRoot })

    expect(readFileSync(path.join(outputRoot, "apple-calendar-mcp", "bridge", "CalendarAPIBridge"), "utf8"))
      .toBe("arch-release")
  })

  test("stages Apple Calendar without throwing when the bridge binary is missing", () => {
    const repoRoot = createTempDir()
    const extensionsRoot = path.join(repoRoot, "packages", "extensions")
    const outputRoot = path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions")
    writeRuntimeExtension(extensionsRoot, "apple-calendar-mcp")

    expect(() => stageBundledExtensions({ extensionsRoot, outputRoot })).not.toThrow()
    expect(existsSync(path.join(outputRoot, "apple-calendar-mcp", "manifest.json"))).toBe(true)
    expect(existsSync(path.join(outputRoot, "apple-calendar-mcp", "bridge", "CalendarAPIBridge"))).toBe(false)
  })

  test("produces a staged resources tree that the registry reads unchanged in packaged mode", () => {
    const repoRoot = createTempDir()
    const extensionsRoot = path.join(repoRoot, "packages", "extensions")
    const outputRoot = path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions")
    writeRuntimeExtension(extensionsRoot, "template-mcp")
    writeRuntimeExtension(extensionsRoot, "canvas-mcp")

    stageBundledExtensions({ extensionsRoot, outputRoot })

    const registry = new PluginRegistry({
      bundledCatalogDir: outputRoot,
      userExtensionStoreDir: createTempDir(),
    })

    const availableIds = registry.list()
      .filter((entry) => entry.kind === "available")
      .map((entry) => entry.manifest.id)

    expect(availableIds).toEqual(["canvas-mcp", "template-mcp"])
  })
})
