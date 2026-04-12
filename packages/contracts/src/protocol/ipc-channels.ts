import type { DesktopBootstrap } from "./desktop.js"
import type {
  ExtensionLifecycleStatus,
  ExtensionRegistryEntry,
} from "../schemas/extension.js"

export const IpcChannel = {
  APP_GET_PATH: "app:get-path",
  APP_GET_BOOTSTRAP: "app:get-bootstrap",
  NOTIFICATION_SHOW: "notification:show",
  TRAY_UPDATE_BADGE: "tray:update-badge",
  FILE_OPEN_DIALOG: "file:open-dialog",
  FILE_SAVE_DIALOG: "file:save-dialog",
  CODEX_AUTH_START: "codex:auth-start",
  CODEX_AUTH_STATUS: "codex:auth-status",
  PLUGIN_LIST: "plugin:list",
  PLUGIN_START: "plugin:start",
  PLUGIN_STOP: "plugin:stop",
  PLUGIN_RETRY: "plugin:retry",
  PLUGIN_INSTALL_BUNDLED: "plugin:install-bundled",
  PLUGIN_SET_ENABLED: "plugin:set-enabled",
  PLUGIN_UNINSTALL: "plugin:uninstall",
  PLUGIN_GET_STATUS: "plugin:get-status",
  PLUGIN_LIFECYCLE: "plugin:lifecycle",
  PLUGIN_GET_AUTH_STATUS: "plugin:get-auth-status",
  PLUGIN_SAVE_AUTH: "plugin:save-auth",
} as const

export type IpcChannel = (typeof IpcChannel)[keyof typeof IpcChannel]

export type CodexAuthResult = {
  readonly status: "connected" | "failed"
  readonly error?: string
}

export type PluginInstallBundledParams = {
  readonly pluginId: string
}

export type PluginSetEnabledParams = {
  readonly pluginId: string
  readonly enabled: boolean
}

export type PluginUninstallParams = {
  readonly pluginId: string
}

export type PluginGetStatusParams = {
  readonly pluginId: string
}

export type PluginStartParams = {
  readonly pluginId: string
}

export type PluginStopParams = {
  readonly pluginId: string
}

export type PluginRetryParams = {
  readonly pluginId: string
}

export type PluginGetAuthStatusParams = {
  readonly pluginId: string
}

export type PluginSaveAuthParams = {
  readonly pluginId: string
  readonly values: Record<string, string>
}

export type PluginManagementFailureReason = "plugin_system_disabled" | "not_implemented"

export type PluginManagementActionResult =
  | {
    readonly ok: true
    readonly pluginId: string
    readonly status: ExtensionLifecycleStatus
  }
  | {
    readonly ok: false
    readonly pluginId: string
    readonly reason: PluginManagementFailureReason
  }

export type PluginLifecycleFailureReason =
  | "plugin_system_disabled"
  | "plugin_not_found"
  | "invalid_plugin"
  | "unsupported_transport"
  | "already_running"
  | "not_running"
  | "start_failed"

export type PluginLifecycleActionResult =
  | {
    readonly ok: true
    readonly pluginId: string
    readonly status: ExtensionLifecycleStatus
  }
  | {
    readonly ok: false
    readonly pluginId: string
    readonly reason: PluginLifecycleFailureReason
  }

export type PluginLifecycleEvent = {
  readonly pluginId: string
  readonly status: ExtensionLifecycleStatus
  readonly emittedAt: string
}

export type PluginAuthStatusState = "not_configured" | "configured" | "error"

export type PluginAuthStatus = {
  readonly pluginId: string
  readonly status: PluginAuthStatusState
  readonly error?: string
}

export type PluginSaveAuthFailureReason =
  | "plugin_system_disabled"
  | "plugin_not_found"
  | "invalid_plugin"
  | "unsupported_auth_type"
  | "validation_failed"
  | "storage_unavailable"
  | "save_failed"

export type PluginSaveAuthResult =
  | {
    readonly ok: true
    readonly pluginId: string
    readonly status: Extract<PluginAuthStatusState, "configured">
  }
  | {
    readonly ok: false
    readonly pluginId: string
    readonly reason: PluginSaveAuthFailureReason
    readonly error: string
    readonly fieldErrors?: Record<string, string>
  }

export type IpcInvokeArgsMap = {
  [IpcChannel.APP_GET_PATH]: [name: string]
  [IpcChannel.APP_GET_BOOTSTRAP]: []
  [IpcChannel.NOTIFICATION_SHOW]: [options: { title: string; body: string }]
  [IpcChannel.TRAY_UPDATE_BADGE]: [options: { count: number }]
  [IpcChannel.FILE_OPEN_DIALOG]: [options?: {
    filters?: Array<{ name: string; extensions: string[] }>
    directory?: boolean
  }]
  [IpcChannel.FILE_SAVE_DIALOG]: [options?: { defaultPath?: string }]
  [IpcChannel.CODEX_AUTH_START]: []
  [IpcChannel.CODEX_AUTH_STATUS]: []
  [IpcChannel.PLUGIN_LIST]: []
  [IpcChannel.PLUGIN_START]: [params: PluginStartParams]
  [IpcChannel.PLUGIN_STOP]: [params: PluginStopParams]
  [IpcChannel.PLUGIN_RETRY]: [params: PluginRetryParams]
  [IpcChannel.PLUGIN_INSTALL_BUNDLED]: [params: PluginInstallBundledParams]
  [IpcChannel.PLUGIN_SET_ENABLED]: [params: PluginSetEnabledParams]
  [IpcChannel.PLUGIN_UNINSTALL]: [params: PluginUninstallParams]
  [IpcChannel.PLUGIN_GET_STATUS]: [params: PluginGetStatusParams]
  [IpcChannel.PLUGIN_GET_AUTH_STATUS]: [params: PluginGetAuthStatusParams]
  [IpcChannel.PLUGIN_SAVE_AUTH]: [params: PluginSaveAuthParams]
}

export type IpcInvokeResultMap = {
  [IpcChannel.APP_GET_PATH]: string
  [IpcChannel.APP_GET_BOOTSTRAP]: DesktopBootstrap
  [IpcChannel.NOTIFICATION_SHOW]: void
  [IpcChannel.TRAY_UPDATE_BADGE]: void
  [IpcChannel.FILE_OPEN_DIALOG]: string | null
  [IpcChannel.FILE_SAVE_DIALOG]: string | null
  [IpcChannel.CODEX_AUTH_START]: CodexAuthResult
  [IpcChannel.CODEX_AUTH_STATUS]: { status: "pending" | "connected" | "failed"; error?: string }
  [IpcChannel.PLUGIN_LIST]: ExtensionRegistryEntry[]
  [IpcChannel.PLUGIN_START]: PluginLifecycleActionResult
  [IpcChannel.PLUGIN_STOP]: PluginLifecycleActionResult
  [IpcChannel.PLUGIN_RETRY]: PluginLifecycleActionResult
  [IpcChannel.PLUGIN_INSTALL_BUNDLED]: PluginManagementActionResult
  [IpcChannel.PLUGIN_SET_ENABLED]: PluginManagementActionResult
  [IpcChannel.PLUGIN_UNINSTALL]: PluginManagementActionResult
  [IpcChannel.PLUGIN_GET_STATUS]: ExtensionRegistryEntry | null
  [IpcChannel.PLUGIN_GET_AUTH_STATUS]: PluginAuthStatus | null
  [IpcChannel.PLUGIN_SAVE_AUTH]: PluginSaveAuthResult
}

export type IpcEventPayloadMap = {
  [IpcChannel.PLUGIN_LIFECYCLE]: PluginLifecycleEvent
}
