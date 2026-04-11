import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import {
  ExtensionManifestValidationError,
  parseExtensionManifestSync,
  type ExtensionInstallSource,
  type ExtensionRegistryEntry,
} from "@student-claw/contracts"

export type PluginRegistryPaths = {
  bundledCatalogDir: string
  userExtensionStoreDir: string
}

const INSTALL_SOURCE_ORDER: Record<ExtensionInstallSource, number> = {
  system: 0,
  bundled: 1,
  user: 2,
}

function isManifestValidationError(error: unknown): error is ExtensionManifestValidationError {
  return typeof error === "object" && error !== null && "_tag" in error
    && error._tag === "ExtensionManifestValidationError"
}

function getEntryLabel(entry: ExtensionRegistryEntry): string {
  return entry.kind === "available" ? entry.manifest.name : entry.displayName
}

function getEntryPluginId(entry: ExtensionRegistryEntry): string {
  return entry.kind === "available" ? entry.manifest.id : entry.pluginId
}

function buildManifestErrorMessage(error: unknown): string {
  if (isManifestValidationError(error)) {
    if (error.issues.length > 0) {
      return error.issues.join("; ")
    }
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function discoverManifestPaths(rootDir: string): string[] {
  if (!existsSync(rootDir)) {
    return []
  }

  return readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootDir, entry.name, "manifest.json"))
    .filter((manifestPath) => existsSync(manifestPath))
}

function parseRegistryEntry(
  manifestPath: string,
  installSource: ExtensionInstallSource,
): ExtensionRegistryEntry {
  const fallbackId = path.basename(path.dirname(manifestPath))
  const fallbackName = fallbackId

  try {
    const contents = readFileSync(manifestPath, "utf8")
    const decoded = JSON.parse(contents) as unknown
    const manifest = parseExtensionManifestSync(decoded)

    return {
      kind: "available",
      manifest,
      installSource,
      status: "discovered",
      enabled: true,
    }
  } catch (error) {
    let pluginId = fallbackId
    let displayName = fallbackName

    if (isManifestValidationError(error)) {
      pluginId = error.pluginId ?? fallbackId

      try {
        const decoded = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>
        if (typeof decoded.name === "string" && decoded.name.trim().length > 0) {
          displayName = decoded.name
        }
      } catch {
        // Keep the directory-name fallback when the manifest cannot be parsed twice.
      }
    }

    return {
      kind: "invalid",
      pluginId,
      displayName,
      installSource,
      status: "error",
      enabled: false,
      lastError: buildManifestErrorMessage(error),
      manifestPath,
    }
  }
}

function sortRegistryEntries(entries: ExtensionRegistryEntry[]): ExtensionRegistryEntry[] {
  return [...entries].sort((left, right) => {
    const sourceDelta = getInstallSourceOrder(left.installSource) - getInstallSourceOrder(right.installSource)
    if (sourceDelta !== 0) {
      return sourceDelta
    }

    const labelDelta = getEntryLabel(left).localeCompare(getEntryLabel(right))
    if (labelDelta !== 0) {
      return labelDelta
    }

    return getEntryPluginId(left).localeCompare(getEntryPluginId(right))
  })
}

function getInstallSourceOrder(installSource: ExtensionInstallSource): number {
  return INSTALL_SOURCE_ORDER[installSource]
}

export class PluginRegistry {
  constructor(private readonly paths: PluginRegistryPaths) {}

  list(): ExtensionRegistryEntry[] {
    const bundledEntries = discoverManifestPaths(this.paths.bundledCatalogDir)
      .map((manifestPath) => parseRegistryEntry(manifestPath, "bundled"))
    const userEntries = discoverManifestPaths(this.paths.userExtensionStoreDir)
      .map((manifestPath) => parseRegistryEntry(manifestPath, "user"))

    return sortRegistryEntries([...bundledEntries, ...userEntries])
  }

  getStatus(pluginId: string): ExtensionRegistryEntry | null {
    return this.list().find((entry) => getEntryPluginId(entry) === pluginId) ?? null
  }
}

export function resolveBundledCatalogDir(currentDir: string, isPackaged: boolean, resourcesPath?: string): string {
  if (isPackaged) {
    return path.join(resourcesPath ?? process.resourcesPath ?? "", "extensions")
  }

  const candidates: [string, string] = [
    path.join(currentDir, "../../../../extensions"),
    path.join(currentDir, "../../../extensions"),
  ]

  return candidates.find(existsSync) ?? candidates[0]
}

export function resolveUserExtensionStoreDir(userDataPath: string): string {
  return path.join(userDataPath, "extensions")
}
