import { type PluginLifecycleEvent, type PluginReadinessEvent } from "@orbyt/contracts"
import { PluginAuthService } from "./plugin-auth-service.js"
import { AppleCalendarBridgeManager } from "./apple-calendar-bridge-manager.js"
import {
  PluginRegistry,
  resolveBundledCatalogDir,
  resolveUserExtensionStoreDir,
} from "./plugin-registry.js"
import { PluginManager } from "./plugin-manager.js"
import { PluginVault, resolvePluginVaultDir } from "./plugin-vault.js"
import { PluginEnabledStore } from "./plugin-enabled-store.js"
import { PluginRuntimeLogBuffer } from "./plugin-runtime-log-buffer.js"
import type { AvailablePluginRegistryRecord } from "./plugin-registry.js"
import type { PluginRuntimePreparation } from "./plugin-runtime-preparation.js"

export type PluginRuntime = {
  readonly registry: PluginRegistry
  readonly manager: PluginManager
  readonly authService: PluginAuthService
  readonly vault: PluginVault
  readonly enabledStore: PluginEnabledStore
  readonly appleCalendarBridgeManager: AppleCalendarBridgeManager
  readonly runtimeLogs: PluginRuntimeLogBuffer
}

const NOTION_PLUGIN_ID = "notion-mcp"

export function prepareNotionMcpRuntime(
  record: AvailablePluginRegistryRecord,
  authService: Pick<PluginAuthService, "getCredentialEnvironment">,
): PluginRuntimePreparation | null {
  if (record.entry.manifest.id !== NOTION_PLUGIN_ID) {
    return null
  }

  const env = authService.getCredentialEnvironment(NOTION_PLUGIN_ID)
  const token = env?.NOTION_TOKEN
  if (!token) {
    return {
      readiness: "error",
      lastError: "Notion credentials are not configured. Save a Notion integration token in Settings > Connections.",
    }
  }

  return {
    readiness: "ready",
    env: {
      NOTION_TOKEN: token,
    },
  }
}

export function createPluginRuntime(options: {
  readonly currentDir: string
  readonly isPackaged: boolean
  readonly userDataPath: string
  readonly platform?: NodeJS.Platform
  readonly systemVersion?: string
  readonly emitLifecycleEvent?: (event: PluginLifecycleEvent) => void
  readonly emitReadinessEvent?: (event: PluginReadinessEvent) => void
}): PluginRuntime {
  const registry = new PluginRegistry({
    bundledCatalogDir: resolveBundledCatalogDir(options.currentDir, options.isPackaged),
    userExtensionStoreDir: resolveUserExtensionStoreDir(options.userDataPath),
    availability: {
      platform: options.platform ?? process.platform,
      systemVersion: options.systemVersion,
    },
  })
  const vault = new PluginVault(resolvePluginVaultDir(options.userDataPath))
  const authService = new PluginAuthService({
    registry,
    vault,
  })
  const enabledStore = new PluginEnabledStore(options.userDataPath)
  const runtimeLogs = new PluginRuntimeLogBuffer()
  const emitRuntimeLog = (entry: import("@orbyt/contracts").PluginRuntimeLogEntry) => {
    runtimeLogs.addEntry(entry)
  }
  const appleCalendarBridgeManager = new AppleCalendarBridgeManager({
    currentDir: options.currentDir,
    isPackaged: options.isPackaged,
    emitRuntimeLog,
  })
  const manager = new PluginManager({
    registry,
    emitLifecycleEvent: options.emitLifecycleEvent,
    emitReadinessEvent: options.emitReadinessEvent,
    emitRuntimeLog,
    getCredentialMessage: (pluginId) => authService.getCredentialMessage(pluginId),
    prepareRuntime: async (record) => {
      if (record.entry.manifest.id === "apple-calendar-mcp") {
        return appleCalendarBridgeManager.ensureReady()
      }

      return prepareNotionMcpRuntime(record, authService)
    },
    cleanupRuntime: async (record) => {
      if (record.entry.manifest.id !== "apple-calendar-mcp") {
        return
      }

      await appleCalendarBridgeManager.stop()
    },
    shouldAutoStart: (entry) => {
      if (entry.manifest.auth.type !== "manual_token") {
        return true
      }

      return authService.getStatus(entry.manifest.id)?.status === "configured"
    },
    enabledStore,
  })

  return {
    registry,
    manager,
    authService,
    vault,
    enabledStore,
    appleCalendarBridgeManager,
    runtimeLogs,
  }
}
