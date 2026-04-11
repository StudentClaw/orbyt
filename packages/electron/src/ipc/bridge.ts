import {
  BrowserWindow,
  dialog,
  ipcMain,
  app,
  Notification,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from "electron"
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import {
  IpcChannel,
  type CodexAuthResult,
  type DesktopBootstrap,
  type ExtensionRegistryEntry,
  type PluginGetStatusParams,
  type PluginInstallBundledParams,
  type PluginLifecycleActionResult,
  type PluginManagementActionResult,
  type PluginRetryParams,
  type PluginStartParams,
  type PluginStopParams,
  type PluginSetEnabledParams,
  type PluginUninstallParams,
} from "@student-claw/contracts"
import { IPC_CHANNELS } from "./channels.js"
import {
  PluginRegistry,
  resolveBundledCatalogDir,
  resolveUserExtensionStoreDir,
} from "../plugins/plugin-registry.js"
import { PluginManager } from "../plugins/plugin-manager.js"

const currentDir = path.dirname(fileURLToPath(import.meta.url))

function resolveCodexPath(): string {
  const candidates = [
    // Bundled binary (production)
    path.join(currentDir, "../../resources/codex"),
    path.join(currentDir, "../../../resources/codex"),
    // Local node_modules (dev)
    path.join(currentDir, "../../node_modules/.bin/codex"),
    path.join(currentDir, "../../../node_modules/.bin/codex"),
    path.join(currentDir, "../../../../node_modules/.bin/codex"),
  ]
  return candidates.find(existsSync) ?? "codex"
}

/**
 * Registers the Electron main-process IPC handlers needed by the renderer runtime.
 */
export function registerIpcHandlers(bootstrap: DesktopBootstrap): { pluginManager: PluginManager } {
  ipcMain.handle(IPC_CHANNELS.APP_GET_PATH, (_event, name: string) => {
    return app.getPath(name as Parameters<typeof app.getPath>[0])
  })

  ipcMain.handle(IPC_CHANNELS.APP_GET_BOOTSTRAP, () => {
    return bootstrap
  })

  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_SHOW, (_event, options: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: options.title,
        body: options.body,
      })
      notification.show()
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.FILE_OPEN_DIALOG,
    async (
      _event,
      options?: {
        filters?: Array<{ name: string; extensions: string[] }>
        directory?: boolean
      },
    ): Promise<string | null> => {
      const window = BrowserWindow.getFocusedWindow()
      const dialogOptions: OpenDialogOptions = {
        properties: options?.directory ? ["openDirectory"] : ["openFile"],
        filters: options?.filters,
      }
      const result = window
        ? await dialog.showOpenDialog(window, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)
      if (result.canceled) {
        return null
      }

      return result.filePaths[0] ?? null
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.FILE_SAVE_DIALOG,
    async (
      _event,
      options?: {
        defaultPath?: string
      },
    ): Promise<string | null> => {
      const window = BrowserWindow.getFocusedWindow()
      const dialogOptions: SaveDialogOptions = {
        defaultPath: options?.defaultPath,
      }
      const result = window
        ? await dialog.showSaveDialog(window, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions)
      return result.canceled ? null : (result.filePath ?? null)
    },
  )

  ipcMain.handle(IPC_CHANNELS.CODEX_AUTH_START, (): Promise<CodexAuthResult> => {
    const codexPath = resolveCodexPath()

    return new Promise((resolve) => {
      const proc = spawn(codexPath, ["login"], { stdio: "pipe" })
      const OAUTH_TIMEOUT_MS = 120_000

      const timer = setTimeout(() => {
        proc.kill()
        resolve({ status: "failed", error: "OAuth timed out" })
      }, OAUTH_TIMEOUT_MS)

      proc.on("exit", (code) => {
        clearTimeout(timer)
        if (code === 0) {
          resolve({ status: "connected" })
        } else {
          resolve({ status: "failed", error: "Codex login failed" })
        }
      })

      proc.on("error", (err) => {
        clearTimeout(timer)
        const message = (err as NodeJS.ErrnoException).code === "ENOENT"
          ? "Codex CLI not found. Install it with: npm install -g @openai/codex"
          : err.message
        resolve({ status: "failed", error: message })
      })
    })
  })

  return registerPluginIpcHandlers(bootstrap)
}

function buildPluginActionResult(
  bootstrap: DesktopBootstrap,
  pluginId: string,
): PluginManagementActionResult {
  return {
    ok: false,
    pluginId,
    reason: bootstrap.featureFlags.pluginSystem ? "not_implemented" : "plugin_system_disabled",
  }
}

function buildPluginLifecycleActionResult(
  bootstrap: DesktopBootstrap,
  pluginId: string,
): PluginLifecycleActionResult {
  return {
    ok: false,
    pluginId,
    reason: bootstrap.featureFlags.pluginSystem ? "start_failed" : "plugin_system_disabled",
  }
}

function emitPluginLifecycle(payload: { pluginId: string; status: ExtensionRegistryEntry["status"]; emittedAt: string }): void {
  const windows = typeof BrowserWindow.getAllWindows === "function" ? BrowserWindow.getAllWindows() : []
  for (const window of windows) {
    window.webContents.send(IpcChannel.PLUGIN_LIFECYCLE, payload)
  }
}

function registerPluginIpcHandlers(bootstrap: DesktopBootstrap): { pluginManager: PluginManager } {
  const pluginRegistry = new PluginRegistry({
    bundledCatalogDir: resolveBundledCatalogDir(currentDir, app.isPackaged),
    userExtensionStoreDir: resolveUserExtensionStoreDir(app.getPath("userData")),
  })
  const pluginManager = new PluginManager({
    registry: pluginRegistry,
    emitLifecycleEvent: emitPluginLifecycle,
  })

  ipcMain.handle(IpcChannel.PLUGIN_LIST, (): ExtensionRegistryEntry[] => {
    return pluginManager.list()
  })

  ipcMain.handle(
    IpcChannel.PLUGIN_START,
    (_event, params: PluginStartParams): Promise<PluginLifecycleActionResult> | PluginLifecycleActionResult => {
      if (!bootstrap.featureFlags.pluginSystem) {
        return buildPluginLifecycleActionResult(bootstrap, params.pluginId)
      }

      return pluginManager.start(params.pluginId)
    },
  )

  ipcMain.handle(
    IpcChannel.PLUGIN_STOP,
    (_event, params: PluginStopParams): Promise<PluginLifecycleActionResult> | PluginLifecycleActionResult => {
      if (!bootstrap.featureFlags.pluginSystem) {
        return buildPluginLifecycleActionResult(bootstrap, params.pluginId)
      }

      return pluginManager.stop(params.pluginId)
    },
  )

  ipcMain.handle(
    IpcChannel.PLUGIN_RETRY,
    (_event, params: PluginRetryParams): Promise<PluginLifecycleActionResult> | PluginLifecycleActionResult => {
      if (!bootstrap.featureFlags.pluginSystem) {
        return buildPluginLifecycleActionResult(bootstrap, params.pluginId)
      }

      return pluginManager.retry(params.pluginId)
    },
  )

  ipcMain.handle(
    IpcChannel.PLUGIN_INSTALL_BUNDLED,
    (_event, params: PluginInstallBundledParams): PluginManagementActionResult => {
      return buildPluginActionResult(bootstrap, params.pluginId)
    },
  )

  ipcMain.handle(
    IpcChannel.PLUGIN_SET_ENABLED,
    (_event, params: PluginSetEnabledParams): PluginManagementActionResult => {
      return buildPluginActionResult(bootstrap, params.pluginId)
    },
  )

  ipcMain.handle(
    IpcChannel.PLUGIN_UNINSTALL,
    (_event, params: PluginUninstallParams): PluginManagementActionResult => {
      return buildPluginActionResult(bootstrap, params.pluginId)
    },
  )

  ipcMain.handle(
    IpcChannel.PLUGIN_GET_STATUS,
    (_event, params: PluginGetStatusParams): ExtensionRegistryEntry | null => {
      return pluginManager.getStatus(params.pluginId)
    },
  )

  return {
    pluginManager,
  }
}
