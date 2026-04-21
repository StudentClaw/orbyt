import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import path from "node:path"

export type StageBundledExtensionsOptions = {
  extensionsRoot: string
  outputRoot: string
}

const APPLE_CALENDAR_PLUGIN_ID = "apple-calendar-mcp"
const APPLE_BRIDGE_BINARY_NAME = "CalendarAPIBridge"

function discoverBundledExtensionDirs(extensionsRoot: string): string[] {
  if (!existsSync(extensionsRoot)) {
    return []
  }

  return readdirSync(extensionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(extensionsRoot, entry.name))
    .filter((extensionDir) => existsSync(path.join(extensionDir, "manifest.json")))
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right)))
}

function resolveBuiltAppleBridgePath(extensionDir: string): string | null {
  const bridgeRoot = path.join(extensionDir, "bridge")
  const directReleasePath = path.join(bridgeRoot, ".build", "release", APPLE_BRIDGE_BINARY_NAME)
  if (existsSync(directReleasePath)) {
    return directReleasePath
  }

  const buildRoot = path.join(bridgeRoot, ".build")
  if (!existsSync(buildRoot)) {
    return null
  }

  for (const entry of readdirSync(buildRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    const candidate = path.join(buildRoot, entry.name, "release", APPLE_BRIDGE_BINARY_NAME)
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

function copyRuntimeSubset(extensionDir: string, stagedExtensionDir: string): void {
  mkdirSync(stagedExtensionDir, { recursive: true })
  cpSync(path.join(extensionDir, "manifest.json"), path.join(stagedExtensionDir, "manifest.json"))

  const distDir = path.join(extensionDir, "dist")
  if (existsSync(distDir)) {
    cpSync(distDir, path.join(stagedExtensionDir, "dist"), {
      recursive: true,
      filter: (source) => !/\.test\.[^.]+$/.test(path.basename(source)),
    })
  }
}

function stageAppleBridge(extensionDir: string, stagedExtensionDir: string): void {
  const bridgeBinaryPath = resolveBuiltAppleBridgePath(extensionDir)
  if (!bridgeBinaryPath) {
    return
  }

  const stagedBridgeDir = path.join(stagedExtensionDir, "bridge")
  mkdirSync(stagedBridgeDir, { recursive: true })
  cpSync(bridgeBinaryPath, path.join(stagedBridgeDir, APPLE_BRIDGE_BINARY_NAME))
}

export function stageBundledExtensions(options: StageBundledExtensionsOptions): string[] {
  rmSync(options.outputRoot, { recursive: true, force: true })
  mkdirSync(options.outputRoot, { recursive: true })

  const stagedPluginIds: string[] = []

  for (const extensionDir of discoverBundledExtensionDirs(options.extensionsRoot)) {
    const pluginId = path.basename(extensionDir)
    const stagedExtensionDir = path.join(options.outputRoot, pluginId)

    copyRuntimeSubset(extensionDir, stagedExtensionDir)
    if (pluginId === APPLE_CALENDAR_PLUGIN_ID) {
      stageAppleBridge(extensionDir, stagedExtensionDir)
    }

    stagedPluginIds.push(pluginId)
  }

  return stagedPluginIds
}

export function getDefaultStageOptions(): StageBundledExtensionsOptions {
  const repoRoot = path.resolve(import.meta.dir, "..")
  return {
    extensionsRoot: path.join(repoRoot, "packages", "extensions"),
    outputRoot: path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions"),
  }
}

if (import.meta.main) {
  const options = getDefaultStageOptions()
  const stagedPluginIds = stageBundledExtensions(options)
  process.stdout.write(`Staged bundled extensions: ${stagedPluginIds.join(", ")}\n`)
}
