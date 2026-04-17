import { type PluginLifecycleEvent } from "@student-claw/contracts"
import { PluginAuthService } from "./plugin-auth-service.js"
import {
  PluginRegistry,
  resolveBundledCatalogDir,
  resolveUserExtensionStoreDir,
} from "./plugin-registry.js"
import { PluginManager } from "./plugin-manager.js"
import { PluginVault, resolvePluginVaultDir } from "./plugin-vault.js"
import { PluginEnabledStore } from "./plugin-enabled-store.js"

export type PluginRuntime = {
  readonly registry: PluginRegistry
  readonly manager: PluginManager
  readonly authService: PluginAuthService
  readonly vault: PluginVault
  readonly enabledStore: PluginEnabledStore
}

export function createPluginRuntime(options: {
  readonly currentDir: string
  readonly isPackaged: boolean
  readonly userDataPath: string
  readonly emitLifecycleEvent?: (event: PluginLifecycleEvent) => void
}): PluginRuntime {
  const registry = new PluginRegistry({
    bundledCatalogDir: resolveBundledCatalogDir(options.currentDir, options.isPackaged),
    userExtensionStoreDir: resolveUserExtensionStoreDir(options.userDataPath),
  })
  const vault = new PluginVault(resolvePluginVaultDir(options.userDataPath))
  const authService = new PluginAuthService({
    registry,
    vault,
  })
  const enabledStore = new PluginEnabledStore(options.userDataPath)
  const manager = new PluginManager({
    registry,
    emitLifecycleEvent: options.emitLifecycleEvent,
    getCredentialMessage: (pluginId) => authService.getCredentialMessage(pluginId),
    enabledStore,
  })

  return {
    registry,
    manager,
    authService,
    vault,
    enabledStore,
  }
}
