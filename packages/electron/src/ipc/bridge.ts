import {
  BrowserWindow,
  dialog,
  ipcMain,
  app,
  Notification,
  shell,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from "electron"
import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, statSync, unlinkSync, watch as fsWatch, writeFileSync } from "node:fs"
import os from "node:os"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { randomUUID } from "node:crypto"
import {
  type AttachmentMetadataLookupParams,
  type StagePastedAttachmentParams,
  type TurnAttachmentInput,
  type WorkspaceFileSearchParams,
  IpcChannel,
  type CodexAuthResult,
  type DesktopBootstrap,
  type ExtensionRegistryEntry,
  type PluginGetStatusParams,
  type PluginGetRuntimeLogsParams,
  type PluginGetAuthStatusParams,
  type PluginInstallBundledParams,
  type PluginAuthStatus,
  type PluginLifecycleActionResult,
  type PluginManagementActionResult,
  type PluginReadinessEvent,
  type PluginRetryParams,
  type PluginRetryClass,
  type PluginRevealPermissionSettingsParams,
  type PluginRevealPermissionSettingsResult,
  type PluginSaveAuthParams,
  type PluginSaveAuthResult,
  type PluginStartParams,
  type PluginStopParams,
  type PluginSetEnabledParams,
  type PluginUninstallParams,
} from "@orbyt/contracts"
import { IPC_CHANNELS } from "./channels.js"
import { buildIsolatedCodexEnv } from "../codex/runtime.js"
import { PluginManager } from "../plugins/plugin-manager.js"
import { PluginAuthService } from "../plugins/plugin-auth-service.js"
import { PluginEnabledStore } from "../plugins/plugin-enabled-store.js"
import { PluginRuntimeLogBuffer } from "../plugins/plugin-runtime-log-buffer.js"
import { createPluginRuntime } from "../plugins/plugin-runtime.js"
import { createPushManager, type PushManager } from "../push/push-manager.js"
import {
  writeCanvasCredentialsFile,
  clearCanvasCredentialsFile,
} from "../plugins/canvas-credentials-file.js"
import { verifyCanvasCredentials } from "../plugins/canvas-credentials-verify.js"
import { createWorkspaceFileSearch } from "./workspace-file-search.js"

const CANVAS_PLUGIN_ID = "canvas-mcp"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
let defaultPushManager: PushManager | null = null

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  ".bmp": "image/bmp",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".xml": "application/xml",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
}

function guessMimeType(filePath: string): string | null {
  return MIME_TYPES_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? null
}

function buildAttachmentMetadata(filePath: string): TurnAttachmentInput | null {
  try {
    const stat = statSync(filePath)
    if (!stat.isFile()) {
      return null
    }

    const mimeType = guessMimeType(filePath)
    return {
      path: filePath,
      name: path.basename(filePath),
      mimeType,
      sizeBytes: stat.size,
      kind: mimeType?.startsWith("image/") ? "image" : "file",
    }
  } catch {
    return null
  }
}

function extensionForMimeType(mimeType: string): string {
  const match = Object.entries(MIME_TYPES_BY_EXTENSION).find(([, value]) => value === mimeType)
  return match?.[0] ?? ".png"
}

function sanitizeAttachmentName(name: string, mimeType: string): string {
  const base = path.basename(name || "pasted-image")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  const fallback = `pasted-image${extensionForMimeType(mimeType)}`
  const candidate = base || fallback
  return path.extname(candidate) ? candidate : `${candidate}${extensionForMimeType(mimeType)}`
}

function stagePastedAttachment(params: StagePastedAttachmentParams): TurnAttachmentInput | null {
  const match = /^data:([^;,]+);base64,(.+)$/u.exec(params.dataUrl)
  if (!match) {
    return null
  }
  const mimeType = params.mimeType || match[1] || "image/png"
  if (!mimeType.startsWith("image/")) {
    return null
  }

  const dir = path.join(app.getPath("userData"), "composer-attachments")
  mkdirSync(dir, { recursive: true })
  const name = sanitizeAttachmentName(params.name, mimeType)
  const filePath = path.join(dir, `${Date.now()}-${randomUUID()}-${name}`)
  writeFileSync(filePath, Buffer.from(match[2] ?? "", "base64"))
  return buildAttachmentMetadata(filePath)
}

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

function registerHandler(channel: string, handler: Parameters<typeof ipcMain.handle>[1]): void {
  if ("removeHandler" in ipcMain && typeof ipcMain.removeHandler === "function") {
    ipcMain.removeHandler(channel)
  }

  ipcMain.handle(channel, handler)
}

function resolvePushManager(
  bootstrap: DesktopBootstrap,
  runtime?: { pluginManager: PluginManager; pluginAuthService: PluginAuthService; pushManager?: PushManager },
): PushManager {
  if (runtime?.pushManager) {
    return runtime.pushManager
  }

  if (!defaultPushManager) {
    defaultPushManager = createPushManager({
      userDataPath: app.getPath("userData"),
      bootstrap,
    })
  }

  return defaultPushManager
}

/**
 * Registers the Electron main-process IPC handlers needed by the renderer runtime.
 */
export function registerIpcHandlers(
  bootstrap: DesktopBootstrap,
  runtime?: { pluginManager: PluginManager; pluginAuthService: PluginAuthService; pluginEnabledStore?: PluginEnabledStore; pluginRuntimeLogs?: PluginRuntimeLogBuffer; pushManager?: PushManager },
): { pluginManager: PluginManager; pluginAuthService: PluginAuthService } {
  const workspaceFileSearch = createWorkspaceFileSearch()

  registerHandler(IPC_CHANNELS.APP_GET_PATH, (_event, name: string) => {
    return app.getPath(name as Parameters<typeof app.getPath>[0])
  })

  registerHandler(IPC_CHANNELS.APP_GET_BOOTSTRAP, () => {
    return bootstrap
  })

  registerHandler(IPC_CHANNELS.NOTIFICATION_SHOW, (_event, options: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: options.title,
        body: options.body,
      })
      notification.show()
    }
  })

  registerHandler(
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

  registerHandler(
    IPC_CHANNELS.FILE_SELECT_ATTACHMENTS,
    async (
      _event,
      params?: {
        filters?: Array<{ name: string; extensions: string[] }>
      },
    ): Promise<string[] | null> => {
      const window = BrowserWindow.getFocusedWindow()
      const dialogOptions: OpenDialogOptions = {
        properties: ["openFile", "multiSelections"],
        filters: params?.filters,
      }
      const result = window
        ? await dialog.showOpenDialog(window, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)

      return result.canceled ? null : result.filePaths
    },
  )

  registerHandler(
    IPC_CHANNELS.FILE_GET_ATTACHMENT_METADATA,
    (_event, params: AttachmentMetadataLookupParams): TurnAttachmentInput[] => {
      const results = params.paths
        .map((filePath) => buildAttachmentMetadata(filePath))
        .filter((entry): entry is TurnAttachmentInput => entry !== null)
      for (const entry of results) {
        workspaceFileSearch.recordRecent(entry.path)
      }
      return results
    },
  )

  registerHandler(
    IPC_CHANNELS.FILE_STAGE_PASTED_ATTACHMENT,
    (_event, params: StagePastedAttachmentParams): TurnAttachmentInput | null => {
      const attachment = stagePastedAttachment(params)
      if (attachment) {
        workspaceFileSearch.recordRecent(attachment.path)
      }
      return attachment
    },
  )

  registerHandler(
    IPC_CHANNELS.FILE_SEARCH_WORKSPACE,
    (_event, params: WorkspaceFileSearchParams): Promise<TurnAttachmentInput[]> => {
      return workspaceFileSearch(params)
    },
  )

  registerHandler(
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

  registerHandler(
    IPC_CHANNELS.FILE_REVEAL_IN_FOLDER,
    (_event, params?: { path?: string }): boolean => {
      const filePath = params?.path?.trim()
      if (!filePath || !existsSync(filePath)) {
        return false
      }

      shell.showItemInFolder(filePath)
      return true
    },
  )

  registerHandler(
    IPC_CHANNELS.SHELL_OPEN_EXTERNAL,
    async (_event, params?: { url?: string }): Promise<{ ok: boolean }> => {
      const raw = params?.url?.trim()
      if (!raw) {
        return { ok: false }
      }
      let parsed: URL
      try {
        parsed = new URL(raw)
      } catch {
        return { ok: false }
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false }
      }
      try {
        await shell.openExternal(parsed.toString())
        return { ok: true }
      } catch {
        return { ok: false }
      }
    },
  )

  registerHandler(IPC_CHANNELS.CODEX_AUTH_START, (): Promise<CodexAuthResult> => {
    const codexPath = resolveCodexPath()
    const userDataPath = app.getPath("userData")
    const codexHomePath = path.join(userDataPath, "codex-home")
    const authJsonPath = path.join(codexHomePath, "auth.json")
    const disconnectedMarker = path.join(codexHomePath, ".disconnected")
    if (existsSync(disconnectedMarker)) {
      try { unlinkSync(disconnectedMarker) } catch { /* ignore */ }
    }
    // Capture pre-spawn auth.json state so the watcher can distinguish a
    // freshly-written file from a stale one left over from prior sessions.
    const previousAuthMtimeMs = (() => {
      try {
        return statSync(authJsonPath).mtimeMs
      } catch {
        return null
      }
    })()
    const env = buildIsolatedCodexEnv(userDataPath)

    return new Promise((resolve) => {
      const proc = spawn(codexPath, ["login"], {
        env,
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      })
      const OAUTH_TIMEOUT_MS = 120_000

      // Drain stdout/stderr so a full pipe buffer never blocks codex from exiting
      // after it writes auth.json. Without this, a single verbose log line on
      // success can deadlock the child process.
      proc.stdout?.on("data", () => {})
      proc.stderr?.on("data", () => {})

      let settled = false
      const finish = (result: CodexAuthResult): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        clearInterval(poll)
        clearInterval(fastPoll)
        try { watcher?.close() } catch { /* ignore */ }
        if (!proc.killed) {
          // Best-effort cleanup: codex may still be lingering after writing
          // auth.json. We have the signal we need; let it go.
          try { proc.kill() } catch { /* ignore */ }
        }
        resolve(result)
      }

      const checkAuthJsonReady = (): boolean => {
        try {
          const stats = statSync(authJsonPath)
          if (stats.size <= 0) return false
          if (previousAuthMtimeMs !== null && stats.mtimeMs <= previousAuthMtimeMs) {
            return false
          }
          return true
        } catch {
          return false
        }
      }

      const checkLoginStatusReady = (): boolean => {
        try {
          const status = spawnSync(codexPath, ["login", "status"], {
            env,
            encoding: "utf8",
            shell: process.platform === "win32",
            timeout: 4_000,
          })
          if (status.status !== 0) return false
          const combined = `${status.stdout ?? ""}\n${status.stderr ?? ""}`.toLowerCase()
          return combined.includes("logged in") || combined.includes("authenticated")
        } catch {
          return false
        }
      }

      const timer = setTimeout(() => {
        finish({ status: "failed", error: "OAuth timed out" })
      }, OAUTH_TIMEOUT_MS)

      // Watch the codex-home directory for auth.json being (re)written. This is
      // the authoritative success signal: codex login may print a final line and
      // hang on stdin or otherwise fail to emit a clean "exit", but auth.json
      // appearing with a fresh mtime means OAuth completed.
      // Note: macOS FSEvents often delivers atomic rename events with a null or
      // temp-file filename, so re-check on every event rather than filtering.
      let watcher: ReturnType<typeof fsWatch> | null = null
      try {
        watcher = fsWatch(codexHomePath, () => {
          if (checkAuthJsonReady()) {
            finish({ status: "connected" })
          }
        })
      } catch {
        // If the watcher can't attach we fall back to process exit / timeout.
        watcher = null
      }

      // Fast file-only poll: hits the disk every 250ms with a cheap statSync.
      // This is the primary fallback when fsWatch misses an event — much faster
      // than the 1s combined poll, and never blocks on a child process.
      const fastPoll = setInterval(() => {
        if (checkAuthJsonReady()) {
          finish({ status: "connected" })
        }
      }, 250)

      // Slower combined poll that also runs `codex login status`. Catches the
      // rare case where auth.json mtime hasn't moved (e.g., codex re-affirmed
      // an existing session) but the CLI nonetheless reports authenticated.
      const poll = setInterval(() => {
        if (checkAuthJsonReady() || checkLoginStatusReady()) {
          finish({ status: "connected" })
        }
      }, 1_000)

      proc.on("exit", (code) => {
        // Prefer the file-based signal: codex sometimes exits non-zero after
        // success (e.g., on stdin EOF) but auth.json is still valid.
        if (checkAuthJsonReady() || checkLoginStatusReady()) {
          finish({ status: "connected" })
          return
        }
        if (code === 0) {
          finish({ status: "connected" })
        } else {
          finish({ status: "failed", error: "Codex login failed" })
        }
      })

      proc.on("error", (err) => {
        const message = (err as NodeJS.ErrnoException).code === "ENOENT"
          ? "Codex CLI not found. Install it with: npm install -g @openai/codex"
          : err.message
        finish({ status: "failed", error: message })
      })
    })
  })

  registerHandler(IpcChannel.CODEX_AUTH_LOGOUT, (): Promise<{ ok: boolean }> => {
    const codexPath = resolveCodexPath()
    const userDataPath = app.getPath("userData")
    const codexHomePath = path.join(userDataPath, "codex-home")
    const isolatedAuthPath = path.join(codexHomePath, "auth.json")
    const disconnectedMarker = path.join(codexHomePath, ".disconnected")
    const env = buildIsolatedCodexEnv(userDataPath)

    return new Promise((resolve) => {
      const proc = spawn(codexPath, ["logout"], {
        env,
        stdio: "pipe",
        shell: process.platform === "win32",
      })

      const finalize = (cliOk: boolean): void => {
        // Belt-and-suspenders: ensure isolated auth is gone even if the CLI failed,
        // and write a marker so prepareIsolatedCodexRuntime won't re-import the
        // global ~/.codex/auth.json on the next spawn.
        if (existsSync(isolatedAuthPath)) {
          try { unlinkSync(isolatedAuthPath) } catch { /* ignore */ }
        }
        try { writeFileSync(disconnectedMarker, "", "utf8") } catch { /* ignore */ }
        resolve({ ok: cliOk || !existsSync(isolatedAuthPath) })
      }

      proc.on("exit", (code) => {
        finalize(code === 0)
      })

      proc.on("error", () => {
        finalize(false)
      })
    })
  })

  const pushManager = resolvePushManager(bootstrap, runtime)
  registerHandler(IpcChannel.PUSH_GET_SETTINGS, () => pushManager.getSettings())
  registerHandler(IpcChannel.PUSH_UPDATE_SETTINGS, (_event, params) => pushManager.updateSettings(params))

  return registerPluginIpcHandlers(bootstrap, runtime)
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

function buildPluginAuthSaveResult(
  bootstrap: DesktopBootstrap,
  pluginId: string,
): PluginSaveAuthResult {
  return {
    ok: false,
    pluginId,
    reason: "plugin_system_disabled",
    error: bootstrap.featureFlags.pluginSystem
      ? `Plugin auth save is unavailable for ${pluginId}.`
      : "Plugin system is disabled.",
  }
}

function emitPluginLifecycle(payload: { pluginId: string; status: ExtensionRegistryEntry["status"]; emittedAt: string }): void {
  const windows = typeof BrowserWindow.getAllWindows === "function" ? BrowserWindow.getAllWindows() : []
  for (const window of windows) {
    window.webContents.send(IpcChannel.PLUGIN_LIFECYCLE, payload)
  }
}

function emitPluginReadiness(payload: PluginReadinessEvent): void {
  const windows = typeof BrowserWindow.getAllWindows === "function" ? BrowserWindow.getAllWindows() : []
  for (const window of windows) {
    window.webContents.send(IpcChannel.PLUGIN_READINESS, payload)
  }
}

function isPluginRetryClass(value: unknown): value is PluginRetryClass {
  return value === "retry_bridge_start" || value === "retry_permission" || value === "retry_plugin_start"
}

async function revealPluginPermissionSettings(
  bootstrap: DesktopBootstrap,
  params: PluginRevealPermissionSettingsParams,
): Promise<PluginRevealPermissionSettingsResult> {
  if (params.pluginId !== "apple-calendar-mcp") {
    return { ok: false, pluginId: params.pluginId, reason: "unsupported_plugin" }
  }

  if (bootstrap.platform !== "darwin") {
    return { ok: false, pluginId: params.pluginId, reason: "platform_unsupported" }
  }

  const candidates = [
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars",
    "x-apple.systempreferences:com.apple.SystemSettings",
  ]

  for (const candidate of candidates) {
    try {
      await shell.openExternal(candidate)
      return { ok: true, pluginId: params.pluginId }
    } catch {
      continue
    }
  }

  return { ok: false, pluginId: params.pluginId, reason: "open_failed" }
}

function registerPluginIpcHandlers(
  bootstrap: DesktopBootstrap,
  runtime?: { pluginManager: PluginManager; pluginAuthService: PluginAuthService; pluginEnabledStore?: PluginEnabledStore; pluginRuntimeLogs?: PluginRuntimeLogBuffer; pushManager?: PushManager },
): { pluginManager: PluginManager; pluginAuthService: PluginAuthService } {
  const runtimeServices = runtime ?? (() => {
    const createdRuntime = createPluginRuntime({
      currentDir,
      isPackaged: app.isPackaged,
      userDataPath: app.getPath("userData"),
      platform: process.platform,
      systemVersion: os.release(),
      emitLifecycleEvent: emitPluginLifecycle,
      emitReadinessEvent: emitPluginReadiness,
    })

    return {
      pluginManager: createdRuntime.manager,
      pluginAuthService: createdRuntime.authService,
      pluginEnabledStore: createdRuntime.enabledStore,
      pluginRuntimeLogs: createdRuntime.runtimeLogs,
    }
  })()
  const pluginManager = runtimeServices.pluginManager
  const pluginAuthService = runtimeServices.pluginAuthService
  const pluginEnabledStore = runtimeServices.pluginEnabledStore
  const pluginRuntimeLogs = runtimeServices.pluginRuntimeLogs

  registerHandler(IpcChannel.PLUGIN_LIST, (): ExtensionRegistryEntry[] => {
    return pluginManager.list()
  })

  registerHandler(
    IpcChannel.PLUGIN_START,
    (_event, params: PluginStartParams): Promise<PluginLifecycleActionResult> | PluginLifecycleActionResult => {
      if (!bootstrap.featureFlags.pluginSystem) {
        return buildPluginLifecycleActionResult(bootstrap, params.pluginId)
      }

      return pluginManager.start(params.pluginId)
    },
  )

  registerHandler(
    IpcChannel.PLUGIN_STOP,
    (_event, params: PluginStopParams): Promise<PluginLifecycleActionResult> | PluginLifecycleActionResult => {
      if (!bootstrap.featureFlags.pluginSystem) {
        return buildPluginLifecycleActionResult(bootstrap, params.pluginId)
      }

      return pluginManager.stop(params.pluginId)
    },
  )

  registerHandler(
    IpcChannel.PLUGIN_RETRY,
    async (_event, params: PluginRetryParams): Promise<PluginLifecycleActionResult> => {
      if (!bootstrap.featureFlags.pluginSystem) {
        return buildPluginLifecycleActionResult(bootstrap, params.pluginId)
      }

      if (!isPluginRetryClass(params.retryClass)) {
        return {
          ok: false,
          pluginId: params.pluginId,
          reason: "invalid_retry_class",
        }
      }

      if (params.retryClass === "retry_permission") {
        const permissionResult = await revealPluginPermissionSettings(bootstrap, { pluginId: params.pluginId })
        if (!permissionResult.ok) {
          return {
            ok: false,
            pluginId: params.pluginId,
            reason: "start_failed",
          }
        }

        const refreshed = await pluginManager.refreshReadiness(params.pluginId)
        return {
          ok: true,
          pluginId: params.pluginId,
          status: refreshed?.status ?? pluginManager.getStatus(params.pluginId)?.status ?? "discovered",
        }
      }

      return await pluginManager.retry(params.pluginId, params.retryClass)
    },
  )

  registerHandler(
    IpcChannel.PLUGIN_REVEAL_PERMISSION_SETTINGS,
    async (_event, params: PluginRevealPermissionSettingsParams): Promise<PluginRevealPermissionSettingsResult> => {
      return await revealPluginPermissionSettings(bootstrap, params)
    },
  )

  registerHandler(
    IpcChannel.PLUGIN_INSTALL_BUNDLED,
    (_event, params: PluginInstallBundledParams): PluginManagementActionResult => {
      return buildPluginActionResult(bootstrap, params.pluginId)
    },
  )

  registerHandler(
    IpcChannel.PLUGIN_SET_ENABLED,
    (_event, params: PluginSetEnabledParams): PluginManagementActionResult => {
      if (!bootstrap.featureFlags.pluginSystem) {
        return buildPluginActionResult(bootstrap, params.pluginId)
      }

      if (!pluginEnabledStore) {
        return { ok: false, pluginId: params.pluginId, reason: "not_implemented" }
      }

      pluginEnabledStore.setEnabled(params.pluginId, params.enabled)

      if (params.enabled) {
        void pluginManager.start(params.pluginId)
      } else {
        void pluginManager.stop(params.pluginId)
      }

      return { ok: true, pluginId: params.pluginId, status: pluginManager.getStatus(params.pluginId)?.status ?? "discovered" }
    },
  )

  registerHandler(
    IpcChannel.PLUGIN_UNINSTALL,
    (_event, params: PluginUninstallParams): PluginManagementActionResult => {
      return buildPluginActionResult(bootstrap, params.pluginId)
    },
  )

  registerHandler(
    IpcChannel.PLUGIN_GET_STATUS,
    (_event, params: PluginGetStatusParams): ExtensionRegistryEntry | null => {
      return pluginManager.getStatus(params.pluginId)
    },
  )

  registerHandler(
    IpcChannel.PLUGIN_GET_RUNTIME_LOGS,
    (_event, params?: PluginGetRuntimeLogsParams) => {
      return {
        entries: pluginRuntimeLogs?.getEntries(params) ?? [],
      }
    },
  )

  registerHandler(
    IpcChannel.PLUGIN_GET_AUTH_STATUS,
    (_event, params: PluginGetAuthStatusParams): PluginAuthStatus | null => {
      if (!bootstrap.featureFlags.pluginSystem) {
        return {
          pluginId: params.pluginId,
          status: "error",
          error: "Plugin system is disabled.",
        }
      }

      return pluginAuthService.getStatus(params.pluginId)
    },
  )

  registerHandler(
    IpcChannel.PLUGIN_SAVE_AUTH,
    async (_event, params: PluginSaveAuthParams): Promise<PluginSaveAuthResult> => {
      if (!bootstrap.featureFlags.pluginSystem) {
        return buildPluginAuthSaveResult(bootstrap, params.pluginId)
      }

      // Live-verify Canvas credentials before storing so a "configured" badge
      // means the next sync will succeed. Other plugins skip this step.
      // When the secret input is empty but a saved token already exists, fall
      // back to the stored value so URL-only edits still verify successfully.
      if (params.pluginId === CANVAS_PLUGIN_ID) {
        const baseUrl = params.values?.baseUrl?.trim() ?? ""
        let token = params.values?.token?.trim() ?? ""
        if (baseUrl && !token) {
          const existing = pluginAuthService.getCredentialMessage(params.pluginId)
          const existingToken = existing?.payload.token?.trim() ?? ""
          if (existingToken) token = existingToken
        }
        if (baseUrl && token) {
          const verification = await verifyCanvasCredentials({ baseUrl, token })
          if (!verification.ok) {
            return {
              ok: false,
              pluginId: params.pluginId,
              reason: "validation_failed",
              error: verification.message,
              fieldErrors: verification.fieldErrors,
            }
          }
        }
      }

      const result = pluginAuthService.saveCredentials(params)

      if (result.ok && params.pluginId === CANVAS_PLUGIN_ID) {
        const merged = pluginAuthService.getCredentialMessage(params.pluginId)
        const baseUrl = merged?.payload.baseUrl?.trim()
        const token = merged?.payload.token?.trim()
        if (baseUrl && token) {
          try {
            writeCanvasCredentialsFile({ baseUrl, token })
          } catch (error) {
            process.stderr.write(`Failed to write canvas credentials file: ${String(error)}\n`)
          }
        }
      }

      return result
    },
  )

  registerHandler(
    IpcChannel.PLUGIN_CLEAR_AUTH,
    (_event, params: { pluginId: string }): { ok: boolean } => {
      if (!bootstrap.featureFlags.pluginSystem) {
        return { ok: false }
      }
      pluginAuthService.clearCredentials(params.pluginId)
      if (params.pluginId === CANVAS_PLUGIN_ID) {
        clearCanvasCredentialsFile()
      }
      return { ok: true }
    },
  )

  return {
    pluginManager,
    pluginAuthService,
  }
}
