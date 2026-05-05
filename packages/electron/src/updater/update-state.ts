import type {
  DesktopUpdateMode,
  DesktopUpdateState,
} from "@orbyt/contracts"

export function isStableUpdateVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+(?:\+[0-9A-Za-z.-]+)?$/.test(version)
}

export function createInitialDesktopUpdateState(options: {
  currentVersion: string
  mode: DesktopUpdateMode
  enabled: boolean
  disabledReason?: string | null
}): DesktopUpdateState {
  return {
    enabled: options.enabled,
    mode: options.mode,
    status: options.enabled ? "idle" : "disabled",
    currentVersion: options.currentVersion,
    availableVersion: null,
    downloadedVersion: null,
    checkedAt: null,
    downloadPercent: null,
    message: options.enabled ? null : (options.disabledReason ?? "Automatic updates are disabled."),
    errorContext: null,
  }
}

export function getAutoUpdateDisabledReason(args: {
  isPackaged: boolean
  platform: NodeJS.Platform
  disabledByEnv: boolean
  hasUpdateFeedConfig: boolean
}): string | null {
  const supportedPlatforms: readonly NodeJS.Platform[] = ["darwin", "linux", "win32"]
  if (args.disabledByEnv) {
    return "Automatic updates are disabled by environment configuration."
  }
  if (!args.isPackaged) {
    return "Automatic updates are only available in packaged production builds."
  }
  if (!supportedPlatforms.includes(args.platform)) {
    return "Automatic updates are not available for this platform."
  }
  if (!args.hasUpdateFeedConfig) {
    return "This build does not include an update feed."
  }
  return null
}

export function updateMode(state: DesktopUpdateState, mode: DesktopUpdateMode): DesktopUpdateState {
  return {
    ...state,
    mode,
    message: state.status === "downloaded" && mode === "automatic"
      ? "Update downloaded. It will install when Orbyt quits."
      : state.message,
  }
}

export function checkStarted(state: DesktopUpdateState, checkedAt: string): DesktopUpdateState {
  return {
    ...state,
    status: "checking",
    checkedAt,
    message: "Checking for updates...",
    errorContext: null,
  }
}

export function checkFailed(state: DesktopUpdateState, message: string, checkedAt: string): DesktopUpdateState {
  return {
    ...state,
    status: "error",
    checkedAt,
    message,
    downloadPercent: null,
    errorContext: "check",
  }
}

export function updateAvailable(state: DesktopUpdateState, version: string, checkedAt: string): DesktopUpdateState {
  return {
    ...state,
    status: "available",
    availableVersion: version,
    checkedAt,
    downloadedVersion: null,
    downloadPercent: null,
    message: `Orbyt ${version} is available.`,
    errorContext: null,
  }
}

export function noUpdateAvailable(state: DesktopUpdateState, checkedAt: string): DesktopUpdateState {
  return {
    ...state,
    status: "idle",
    availableVersion: null,
    downloadedVersion: null,
    checkedAt,
    downloadPercent: null,
    message: "Orbyt is up to date.",
    errorContext: null,
  }
}

export function downloadStarted(state: DesktopUpdateState): DesktopUpdateState {
  return {
    ...state,
    status: "downloading",
    downloadPercent: 0,
    message: "Downloading update...",
    errorContext: null,
  }
}

export function downloadProgress(state: DesktopUpdateState, percent: number): DesktopUpdateState {
  return {
    ...state,
    status: "downloading",
    downloadPercent: Math.max(0, Math.min(100, percent)),
    message: null,
  }
}

export function downloadFailed(state: DesktopUpdateState, message: string): DesktopUpdateState {
  return {
    ...state,
    status: state.availableVersion ? "available" : "error",
    downloadPercent: null,
    message,
    errorContext: "download",
  }
}

export function downloadCompleted(state: DesktopUpdateState, version: string): DesktopUpdateState {
  return {
    ...state,
    status: "downloaded",
    availableVersion: version,
    downloadedVersion: version,
    downloadPercent: 100,
    message: state.mode === "automatic"
      ? "Update downloaded. It will install when Orbyt quits."
      : "Update downloaded. Restart Orbyt to install it.",
    errorContext: null,
  }
}

export function installFailed(state: DesktopUpdateState, message: string): DesktopUpdateState {
  return {
    ...state,
    status: "downloaded",
    message,
    errorContext: "install",
  }
}
