import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import {
  ExtensionManifestValidationError,
  parseExtensionManifestSync,
  type ExtensionRegistryAvailableEntry,
  type ExtensionInstallSource,
  type ExtensionRegistryEntry,
} from "@orbyt/contracts"
import { isCuratedExtensionVisibleOnHost, type PluginAvailabilityContext } from "./curated-extension-availability.js"

export type PluginRegistryPaths = {
  bundledCatalogDir: string
  userExtensionStoreDir: string
  availability?: PluginAvailabilityContext
}

const INSTALL_SOURCE_ORDER: Record<ExtensionInstallSource, number> = {
  system: 0,
  bundled: 1,
  user: 2,
}

export type PluginRegistryRecord = {
  entry: ExtensionRegistryEntry
  manifestPath: string
}

export type AvailablePluginRegistryRecord = {
  entry: ExtensionRegistryAvailableEntry
  manifestPath: string
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

function parseRegistryRecord(
  manifestPath: string,
  installSource: ExtensionInstallSource,
): PluginRegistryRecord {
  const fallbackId = path.basename(path.dirname(manifestPath))
  const fallbackName = fallbackId

  try {
    const contents = readFileSync(manifestPath, "utf8")
    const decoded = JSON.parse(contents) as unknown
    const manifest = parseExtensionManifestSync(decoded)

    return {
      entry: {
        kind: "available",
        manifest,
        installSource,
        status: "discovered",
        enabled: true,
      },
      manifestPath,
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
      entry: {
        kind: "invalid",
        pluginId,
        displayName,
        installSource,
        status: "error",
        enabled: false,
        lastError: buildManifestErrorMessage(error),
        manifestPath,
      },
      manifestPath,
    }
  }
}

function sortRegistryRecords(records: PluginRegistryRecord[]): PluginRegistryRecord[] {
  return [...records].sort((left, right) => {
    const sourceDelta = getInstallSourceOrder(left.entry.installSource) - getInstallSourceOrder(right.entry.installSource)
    if (sourceDelta !== 0) {
      return sourceDelta
    }

    const labelDelta = getEntryLabel(left.entry).localeCompare(getEntryLabel(right.entry))
    if (labelDelta !== 0) {
      return labelDelta
    }

    return getEntryPluginId(left.entry).localeCompare(getEntryPluginId(right.entry))
  })
}

function getInstallSourceOrder(installSource: ExtensionInstallSource): number {
  return INSTALL_SOURCE_ORDER[installSource]
}

export class PluginRegistry {
  constructor(private readonly paths: PluginRegistryPaths) {}

  private getAvailabilityContext(): PluginAvailabilityContext {
    return this.paths.availability ?? {
      platform: process.platform,
    }
  }

  private listRecords(): PluginRegistryRecord[] {
    const bundledEntries = discoverManifestPaths(this.paths.bundledCatalogDir)
      .map((manifestPath) => parseRegistryRecord(manifestPath, "bundled"))
    const userEntries = discoverManifestPaths(this.paths.userExtensionStoreDir)
      .map((manifestPath) => parseRegistryRecord(manifestPath, "user"))

    return sortRegistryRecords([...bundledEntries, ...userEntries])
  }

  list(): ExtensionRegistryEntry[] {
    const availability = this.getAvailabilityContext()
    return this.listRecords()
      .filter((record) => isCuratedExtensionVisibleOnHost(getEntryPluginId(record.entry), availability))
      .map((record) => record.entry)
  }

  getStatus(pluginId: string): ExtensionRegistryEntry | null {
    return this.getRecord(pluginId)?.entry ?? null
  }

  getRecord(pluginId: string): PluginRegistryRecord | null {
    return this.listRecords().find((record) => getEntryPluginId(record.entry) === pluginId) ?? null
  }

  getAvailableRecord(pluginId: string): AvailablePluginRegistryRecord | null {
    const record = this.getRecord(pluginId)
    if (!record || record.entry.kind !== "available") {
      return null
    }

    return {
      entry: record.entry,
      manifestPath: record.manifestPath,
    }
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
