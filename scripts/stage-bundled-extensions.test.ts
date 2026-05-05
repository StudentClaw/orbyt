import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { PluginRegistry } from "../packages/electron/src/plugins/plugin-registry.js"
import { createBundledExtensionRuntimePackageJson, stageBundledExtensions } from "./stage-bundled-extensions"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-stage-bundled-"))
  tempDirs.push(dir)
  return dir
}

function writeRuntimeExtension(rootDir: string, pluginId: string, options: {
  platforms?: string[]
  dependencies?: Record<string, string>
} = {}): string {
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
    ...(options.platforms ? { platforms: options.platforms } : {}),
    permissions: ["test.permission"],
    auth: {
      type: "none",
    },
    tools: [{ name: `${pluginId}_ping`, description: "Ping" }],
    author: "orbyt",
    homepage: "https://github.com/Orbyt/orbyt",
  }, null, 2))
  writeFileSync(path.join(extensionDir, "package.json"), JSON.stringify({
    name: `@orbyt/${pluginId}`,
    version: "1.0.0",
    private: true,
    type: "module",
    dependencies: options.dependencies ?? (pluginId === "canvas-mcp"
      ? {
        "@effect/schema": "^0.75.5",
        "@modelcontextprotocol/sdk": "^1.29.0",
        "@orbyt/contracts": "workspace:*",
        zod: "^4.1.12",
      }
      : {
        "@modelcontextprotocol/sdk": "^1.29.0",
        "@orbyt/contracts": "workspace:*",
      }),
  }, null, 2))
  writeFileSync(path.join(extensionDir, "dist", "index.js"), `console.log("${pluginId}")\n`)
  writeFileSync(path.join(extensionDir, "dist", "server.test.js"), `console.log("${pluginId}-test")\n`)
  writeFileSync(path.join(extensionDir, "src", "index.ts"), "export {}\n")
  writeFileSync(path.join(extensionDir, "README.md"), `# ${pluginId}\n`)
  return extensionDir
}

function writeContractsPackage(repoRoot: string): void {
  const contractsDir = path.join(repoRoot, "packages", "contracts")
  mkdirSync(path.join(contractsDir, "dist"), { recursive: true })
  writeFileSync(path.join(contractsDir, "dist", "index.js"), "export const contract = true\n")
  writeFileSync(path.join(contractsDir, "package.json"), JSON.stringify({
    name: "@orbyt/contracts",
    version: "0.1.0",
    private: true,
    type: "module",
    main: "dist/index.js",
    exports: {
      ".": {
        default: "./dist/index.js",
      },
    },
    dependencies: {
      "@effect/schema": "^0.75.5",
      effect: "^3.21.0",
    },
  }, null, 2))
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
    writeContractsPackage(repoRoot)
    writeRuntimeExtension(extensionsRoot, "template-mcp")

    const stagedPluginIds = stageBundledExtensions({ extensionsRoot, outputRoot, installDependencies: false })

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
    writeContractsPackage(repoRoot)
    const extensionDir = writeRuntimeExtension(extensionsRoot, "apple-calendar-mcp")
    const directReleaseDir = path.join(extensionDir, "bridge", ".build", "release")
    const archReleaseDir = path.join(extensionDir, "bridge", ".build", "arm64-apple-macosx", "release")
    mkdirSync(directReleaseDir, { recursive: true })
    mkdirSync(archReleaseDir, { recursive: true })
    writeFileSync(path.join(directReleaseDir, "CalendarAPIBridge"), "direct-release")
    writeFileSync(path.join(archReleaseDir, "CalendarAPIBridge"), "arch-release")

    stageBundledExtensions({ extensionsRoot, outputRoot, installDependencies: false })

    expect(readFileSync(path.join(outputRoot, "apple-calendar-mcp", "bridge", "CalendarAPIBridge"), "utf8"))
      .toBe("direct-release")
  })

  test("falls back to an architecture-specific Apple bridge binary when needed", () => {
    const repoRoot = createTempDir()
    const extensionsRoot = path.join(repoRoot, "packages", "extensions")
    const outputRoot = path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions")
    writeContractsPackage(repoRoot)
    const extensionDir = writeRuntimeExtension(extensionsRoot, "apple-calendar-mcp")
    const archReleaseDir = path.join(extensionDir, "bridge", ".build", "arm64-apple-macosx", "release")
    mkdirSync(archReleaseDir, { recursive: true })
    writeFileSync(path.join(archReleaseDir, "CalendarAPIBridge"), "arch-release")

    stageBundledExtensions({ extensionsRoot, outputRoot, installDependencies: false })

    expect(readFileSync(path.join(outputRoot, "apple-calendar-mcp", "bridge", "CalendarAPIBridge"), "utf8"))
      .toBe("arch-release")
  })

  test("stages Apple Calendar without throwing when the bridge binary is missing", () => {
    const repoRoot = createTempDir()
    const extensionsRoot = path.join(repoRoot, "packages", "extensions")
    const outputRoot = path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions")
    writeContractsPackage(repoRoot)
    writeRuntimeExtension(extensionsRoot, "apple-calendar-mcp")

    expect(() => stageBundledExtensions({ extensionsRoot, outputRoot, installDependencies: false })).not.toThrow()
    expect(existsSync(path.join(outputRoot, "apple-calendar-mcp", "manifest.json"))).toBe(true)
    expect(existsSync(path.join(outputRoot, "apple-calendar-mcp", "bridge", "CalendarAPIBridge"))).toBe(false)
  })

  test("excludes Darwin-only bundled extensions from Linux packaged resources", () => {
    const repoRoot = createTempDir()
    const extensionsRoot = path.join(repoRoot, "packages", "extensions")
    const outputRoot = path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions")
    writeContractsPackage(repoRoot)
    writeRuntimeExtension(extensionsRoot, "apple-calendar-mcp", { platforms: ["darwin"] })
    writeRuntimeExtension(extensionsRoot, "canvas-mcp")

    const stagedPluginIds = stageBundledExtensions({
      extensionsRoot,
      outputRoot,
      installDependencies: false,
      targetPlatform: "linux",
    })

    expect(stagedPluginIds).toEqual(["canvas-mcp"])
    expect(existsSync(path.join(outputRoot, "canvas-mcp", "manifest.json"))).toBe(true)
    expect(existsSync(path.join(outputRoot, "apple-calendar-mcp"))).toBe(false)
    expect(JSON.parse(readFileSync(path.join(outputRoot, "package.json"), "utf8")).dependencies).toEqual({
      "@effect/schema": "^0.75.5",
      "@modelcontextprotocol/sdk": "^1.29.0",
      "@orbyt/contracts": "file:vendor/contracts",
      zod: "^4.1.12",
    })
  })

  test("produces a staged resources tree that the registry reads unchanged in packaged mode", () => {
    const repoRoot = createTempDir()
    const extensionsRoot = path.join(repoRoot, "packages", "extensions")
    const outputRoot = path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions")
    writeContractsPackage(repoRoot)
    writeRuntimeExtension(extensionsRoot, "template-mcp")
    writeRuntimeExtension(extensionsRoot, "canvas-mcp")

    stageBundledExtensions({ extensionsRoot, outputRoot, installDependencies: false })

    const registry = new PluginRegistry({
      bundledCatalogDir: outputRoot,
      userExtensionStoreDir: createTempDir(),
    })

    const availableIds = registry.list()
      .filter((entry) => entry.kind === "available")
      .map((entry) => entry.manifest.id)

    expect(availableIds).toEqual(["canvas-mcp", "template-mcp"])
  })

  test("generates a shared runtime package manifest for bundled extension dependencies", () => {
    const repoRoot = createTempDir()
    const extensionsRoot = path.join(repoRoot, "packages", "extensions")
    const templateDir = writeRuntimeExtension(extensionsRoot, "template-mcp")
    const canvasDir = writeRuntimeExtension(extensionsRoot, "canvas-mcp")
    const notionDir = writeRuntimeExtension(extensionsRoot, "notion-mcp", {
      dependencies: {
        "@modelcontextprotocol/sdk": "^1.29.0",
        "@notionhq/notion-mcp-server": "2.2.1",
        "@orbyt/contracts": "workspace:*",
      },
    })

    const packageJson = createBundledExtensionRuntimePackageJson({
      repoRoot,
      extensionDirs: [templateDir, canvasDir, notionDir],
    })

    expect(packageJson.dependencies).toEqual({
      "@effect/schema": "^0.75.5",
      "@modelcontextprotocol/sdk": "^1.29.0",
      "@notionhq/notion-mcp-server": "2.2.1",
      "@orbyt/contracts": "file:vendor/contracts",
      zod: "^4.1.12",
    })
  })

  test("stages the shared node_modules contract dependencies for packaged extensions", () => {
    const repoRoot = createTempDir()
    const extensionsRoot = path.join(repoRoot, "packages", "extensions")
    const outputRoot = path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions")
    writeContractsPackage(repoRoot)
    writeRuntimeExtension(extensionsRoot, "template-mcp")

    stageBundledExtensions({ extensionsRoot, outputRoot, installDependencies: false })

    expect(JSON.parse(readFileSync(path.join(outputRoot, "package.json"), "utf8"))).toMatchObject({
      name: "orbyt-bundled-extension-runtime",
      dependencies: {
        "@orbyt/contracts": "file:vendor/contracts",
      },
    })
    expect(existsSync(path.join(outputRoot, "vendor", "contracts", "dist", "index.js"))).toBe(true)
  })

  test("copies packaged runtime dependencies into each staged extension when node_modules exist", () => {
    const repoRoot = createTempDir()
    const extensionsRoot = path.join(repoRoot, "packages", "extensions")
    const outputRoot = path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions")
    writeContractsPackage(repoRoot)
    writeRuntimeExtension(extensionsRoot, "template-mcp")

    const originalPath = process.env.PATH
    const bunStubDir = path.join(repoRoot, "bin")
    mkdirSync(bunStubDir, { recursive: true })
    writeFileSync(
      path.join(bunStubDir, "bun"),
      [
        "#!/bin/sh",
        "mkdir -p \"$PWD/node_modules/@orbyt/contracts/dist\"",
        "printf 'export const staged = true\\n' > \"$PWD/node_modules/@orbyt/contracts/dist/index.js\"",
      ].join("\n"),
      { mode: 0o755 },
    )

    process.env.PATH = `${bunStubDir}:${originalPath ?? ""}`

    try {
      stageBundledExtensions({ extensionsRoot, outputRoot })
    } finally {
      process.env.PATH = originalPath
    }

    expect(existsSync(path.join(outputRoot, "node_modules", "@orbyt", "contracts", "dist", "index.js"))).toBe(true)
    expect(existsSync(path.join(outputRoot, "template-mcp", "node_modules", "@orbyt", "contracts", "dist", "index.js"))).toBe(true)
  })
})
