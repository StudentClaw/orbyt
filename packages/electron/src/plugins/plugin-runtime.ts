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

export type PluginRuntime = {
  readonly registry: PluginRegistry
  readonly manager: PluginManager
  readonly authService: PluginAuthService
  readonly vault: PluginVault
  readonly enabledStore: PluginEnabledStore
  readonly appleCalendarBridgeManager: AppleCalendarBridgeManager
  readonly runtimeLogs: PluginRuntimeLogBuffer
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
      if (record.entry.manifest.id !== "apple-calendar-mcp") {
        return null
      }

      return appleCalendarBridgeManager.ensureReady()
    },
    cleanupRuntime: async (record) => {
      if (record.entry.manifest.id !== "apple-calendar-mcp") {
        return
      }

      await appleCalendarBridgeManager.stop()
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
