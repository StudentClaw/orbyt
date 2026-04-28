import { app, BrowserWindow, ipcMain } from "electron"
import electronUpdater from "electron-updater"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import {
  IpcChannel,
  type DesktopUpdateActionResult,
  type DesktopUpdateCheckResult,
  type DesktopUpdateMode,
  type DesktopUpdateModeResult,
  type DesktopUpdateState,
} from "@orbyt/contracts"
import { DesktopUpdateSettingsStore } from "./update-settings.js"
import {
  checkFailed,
  checkStarted,
  createInitialDesktopUpdateState,
  downloadCompleted,
  downloadFailed,
  downloadProgress,
  downloadStarted,
  getAutoUpdateDisabledReason,
  installFailed,
  isStableUpdateVersion,
  noUpdateAvailable,
  updateAvailable,
  updateMode,
} from "./update-state.js"

const { autoUpdater } = electronUpdater

const AUTO_UPDATE_STARTUP_DELAY_MS = 30_000
const AUTO_UPDATE_POLL_INTERVAL_MS = 4 * 60 * 60 * 1000

let updateState: DesktopUpdateState | null = null
let updateSettingsStore: DesktopUpdateSettingsStore | null = null
let updateCheckInFlight = false
let updateDownloadInFlight = false
let updateInstallInFlight = false
let updaterConfigured = false
let isQuittingForUpdate = false
let startupTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

function nowIso(): string {
  return new Date().toISOString()
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function emitUpdateState(): void {
  if (!updateState) {
    return
  }

  const windows = typeof BrowserWindow.getAllWindows === "function" ? BrowserWindow.getAllWindows() : []
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IpcChannel.APP_UPDATE_STATE, updateState)
    }
  }
}

function setUpdateState(nextState: DesktopUpdateState): DesktopUpdateState {
  updateState = nextState
  emitUpdateState()
  return nextState
}

function patchUpdateState(patch: Partial<DesktopUpdateState>): DesktopUpdateState {
  const current = getUpdateState()
  return setUpdateState({ ...current, ...patch })
}

function getUpdateState(): DesktopUpdateState {
  if (!updateState) {
    const settings = updateSettingsStore?.read() ?? { mode: "automatic" as const }
    updateState = createInitialDesktopUpdateState({
      currentVersion: app.getVersion(),
      mode: settings.mode,
      enabled: false,
      disabledReason: "Automatic updates have not been configured yet.",
    })
  }
  return updateState
}

function readAppUpdateYml(): Record<string, string> | null {
  try {
    const ymlPath = app.isPackaged
      ? path.join(process.resourcesPath, "app-update.yml")
      : path.join(app.getAppPath(), "dev-app-update.yml")
    if (!existsSync(ymlPath)) {
      return null
    }

    const entries: Record<string, string> = {}
    for (const line of readFileSync(ymlPath, "utf8").split("\n")) {
      const match = /^(\w+):\s*(.+)$/u.exec(line)
      if (match?.[1] && match[2]) {
        entries[match[1]] = match[2].trim()
      }
    }
    return entries.provider ? entries : null
  } catch {
    return null
  }
}

function hasUpdateFeedConfig(): boolean {
  return readAppUpdateYml() !== null || Boolean(process.env.ORBYT_DESKTOP_MOCK_UPDATES)
}

function clearUpdateTimers(): void {
  if (startupTimer) {
    clearTimeout(startupTimer)
    startupTimer = null
  }
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function applyUpdaterMode(mode: DesktopUpdateMode): void {
  autoUpdater.channel = "latest"
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = mode === "automatic"
}

async function checkForUpdates(reason: string): Promise<boolean> {
  const current = getUpdateState()
  if (!updaterConfigured || updateCheckInFlight || current.status === "downloading" || current.status === "downloaded") {
    return false
  }

  updateCheckInFlight = true
  setUpdateState(checkStarted(current, nowIso()))
  console.info(`[desktop-updater] Checking for updates (${reason}).`)

  try {
    await autoUpdater.checkForUpdates()
    return true
  } catch (error) {
    const message = formatErrorMessage(error)
    setUpdateState(checkFailed(getUpdateState(), message, nowIso()))
    console.error(`[desktop-updater] Update check failed: ${message}`)
    return true
  } finally {
    updateCheckInFlight = false
  }
}

async function downloadAvailableUpdate(): Promise<DesktopUpdateActionResult> {
  const current = getUpdateState()
  if (!updaterConfigured || updateDownloadInFlight || current.status !== "available") {
    return { accepted: false, completed: false, state: current }
  }

  updateDownloadInFlight = true
  setUpdateState(downloadStarted(current))
  console.info("[desktop-updater] Downloading update.")

  try {
    await autoUpdater.downloadUpdate()
    return { accepted: true, completed: true, state: getUpdateState() }
  } catch (error) {
    const message = formatErrorMessage(error)
    setUpdateState(downloadFailed(getUpdateState(), message))
    console.error(`[desktop-updater] Update download failed: ${message}`)
    return { accepted: true, completed: false, state: getUpdateState() }
  } finally {
    updateDownloadInFlight = false
  }
}

async function installDownloadedUpdate(): Promise<DesktopUpdateActionResult> {
  const current = getUpdateState()
  if (!updaterConfigured || isQuittingForUpdate || current.status !== "downloaded") {
    return { accepted: false, completed: false, state: current }
  }

  isQuittingForUpdate = true
  updateInstallInFlight = true
  clearUpdateTimers()

  try {
    autoUpdater.quitAndInstall(true, true)
    return { accepted: true, completed: false, state: getUpdateState() }
  } catch (error) {
    const message = formatErrorMessage(error)
    isQuittingForUpdate = false
    updateInstallInFlight = false
    setUpdateState(installFailed(getUpdateState(), message))
    console.error(`[desktop-updater] Update install failed: ${message}`)
    return { accepted: true, completed: false, state: getUpdateState() }
  }
}

function configureMockFeedIfNeeded(): void {
  if (!process.env.ORBYT_DESKTOP_MOCK_UPDATES) {
    return
  }

  autoUpdater.setFeedURL({
    provider: "generic",
    url: `http://localhost:${process.env.ORBYT_DESKTOP_MOCK_UPDATE_SERVER_PORT ?? "3000"}`,
  })
}

function configureUpdaterEvents(): void {
  autoUpdater.on("update-available", (info: { version?: string }) => {
    const version = info.version ?? ""
    if (!isStableUpdateVersion(version)) {
      console.info(`[desktop-updater] Ignoring non-stable update version ${version}.`)
      setUpdateState(noUpdateAvailable(getUpdateState(), nowIso()))
      return
    }

    const nextState = setUpdateState(updateAvailable(getUpdateState(), version, nowIso()))
    console.info(`[desktop-updater] Update available: ${version}.`)
    if (nextState.mode === "automatic") {
      void downloadAvailableUpdate()
    }
  })

  autoUpdater.on("update-not-available", () => {
    setUpdateState(noUpdateAvailable(getUpdateState(), nowIso()))
    console.info("[desktop-updater] No updates available.")
  })

  autoUpdater.on("download-progress", (progress: { percent?: number }) => {
    if (typeof progress.percent === "number") {
      setUpdateState(downloadProgress(getUpdateState(), progress.percent))
    }
  })

  autoUpdater.on("update-downloaded", (info: { version?: string }) => {
    const version = info.version ?? getUpdateState().availableVersion ?? ""
    setUpdateState(downloadCompleted(getUpdateState(), version))
    console.info(`[desktop-updater] Update downloaded: ${version}.`)
  })

  autoUpdater.on("error", (error) => {
    const message = formatErrorMessage(error)
    if (updateInstallInFlight) {
      updateInstallInFlight = false
      isQuittingForUpdate = false
      setUpdateState(installFailed(getUpdateState(), message))
      return
    }

    const context = updateDownloadInFlight ? "download" : updateCheckInFlight ? "check" : null
    patchUpdateState({
      status: "error",
      message,
      errorContext: context,
      downloadPercent: null,
    })
    console.error(`[desktop-updater] Updater error: ${message}`)
  })
}

function registerUpdateIpcHandlers(): void {
  const registerHandler = (channel: string, handler: Parameters<typeof ipcMain.handle>[1]) => {
    if ("removeHandler" in ipcMain && typeof ipcMain.removeHandler === "function") {
      ipcMain.removeHandler(channel)
    }
    ipcMain.handle(channel, handler)
  }

  registerHandler(IpcChannel.APP_UPDATE_GET_STATE, () => getUpdateState())
  registerHandler(IpcChannel.APP_UPDATE_CHECK, async (): Promise<DesktopUpdateCheckResult> => {
    const checked = await checkForUpdates("renderer")
    return { checked, state: getUpdateState() }
  })
  registerHandler(IpcChannel.APP_UPDATE_DOWNLOAD, async (): Promise<DesktopUpdateActionResult> => {
    return await downloadAvailableUpdate()
  })
  registerHandler(IpcChannel.APP_UPDATE_INSTALL, async (): Promise<DesktopUpdateActionResult> => {
    return await installDownloadedUpdate()
  })
  registerHandler(
    IpcChannel.APP_UPDATE_SET_MODE,
    (_event, params: { mode?: DesktopUpdateMode }): DesktopUpdateModeResult => {
      const mode = params.mode === "prompt" ? "prompt" : "automatic"
      updateSettingsStore?.write({ mode })
      applyUpdaterMode(mode)
      const nextState = setUpdateState(updateMode(getUpdateState(), mode))
      if (mode === "automatic" && nextState.status === "available") {
        void downloadAvailableUpdate()
      }
      return { state: getUpdateState() }
    },
  )
}

export function registerStableAutoUpdates(): void {
  updateSettingsStore = new DesktopUpdateSettingsStore(app.getPath("userData"))
  const settings = updateSettingsStore.read()
  const disabledReason = getAutoUpdateDisabledReason({
    isPackaged: app.isPackaged,
    platform: process.platform,
    disabledByEnv: process.env.ORBYT_DISABLE_AUTO_UPDATE === "1",
    hasUpdateFeedConfig: hasUpdateFeedConfig(),
  })

  setUpdateState(createInitialDesktopUpdateState({
    currentVersion: app.getVersion(),
    mode: settings.mode,
    enabled: disabledReason === null,
    disabledReason,
  }))

  registerUpdateIpcHandlers()

  if (disabledReason !== null) {
    console.info(`[desktop-updater] ${disabledReason}`)
    return
  }

  updaterConfigured = true
  configureMockFeedIfNeeded()
  applyUpdaterMode(settings.mode)
  configureUpdaterEvents()
  clearUpdateTimers()

  startupTimer = setTimeout(() => {
    startupTimer = null
    void checkForUpdates("startup")
  }, AUTO_UPDATE_STARTUP_DELAY_MS)
  startupTimer.unref()

  pollTimer = setInterval(() => {
    void checkForUpdates("poll")
  }, AUTO_UPDATE_POLL_INTERVAL_MS)
  pollTimer.unref()
}

export function stopStableAutoUpdates(): void {
  clearUpdateTimers()
}
