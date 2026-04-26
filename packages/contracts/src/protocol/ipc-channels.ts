import type { DesktopBootstrap } from "./desktop.js"
import type { TurnAttachmentInput } from "./orchestration.js"
import type {
  ExtensionLifecycleStatus,
  ExtensionRegistryEntry,
  ExtensionRuntimeReadiness,
} from "../schemas/extension.js"
import type {
  PhonePushSettings,
  PushPairingSession,
  PushPairingStatusResult,
  PushSendTestResult,
  UpdatePhonePushSettingsParams,
} from "../schemas/push-notification.js"

export const IpcChannel = {
  APP_GET_PATH: "app:get-path",
  APP_GET_BOOTSTRAP: "app:get-bootstrap",
  NOTIFICATION_SHOW: "notification:show",
  TRAY_UPDATE_BADGE: "tray:update-badge",
  FILE_OPEN_DIALOG: "file:open-dialog",
  FILE_SELECT_ATTACHMENTS: "file:select-attachments",
  FILE_GET_ATTACHMENT_METADATA: "file:get-attachment-metadata",
  FILE_SAVE_DIALOG: "file:save-dialog",
  FILE_REVEAL_IN_FOLDER: "file:reveal-in-folder",
  CODEX_AUTH_START: "codex:auth-start",
  CODEX_AUTH_STATUS: "codex:auth-status",
  PUSH_GET_SETTINGS: "push:get-settings",
  PUSH_UPDATE_SETTINGS: "push:update-settings",
  PUSH_START_PAIRING: "push:start-pairing",
  PUSH_GET_PAIRING_STATUS: "push:get-pairing-status",
  PUSH_CANCEL_PAIRING: "push:cancel-pairing",
  PUSH_SEND_TEST: "push:send-test",
  PUSH_UNLINK_DEVICE: "push:unlink-device",
  PLUGIN_LIST: "plugin:list",
  PLUGIN_START: "plugin:start",
  PLUGIN_STOP: "plugin:stop",
  PLUGIN_RETRY: "plugin:retry",
  PLUGIN_INSTALL_BUNDLED: "plugin:install-bundled",
  PLUGIN_SET_ENABLED: "plugin:set-enabled",
  PLUGIN_UNINSTALL: "plugin:uninstall",
  PLUGIN_GET_STATUS: "plugin:get-status",
  PLUGIN_GET_RUNTIME_LOGS: "plugin:get-runtime-logs",
  PLUGIN_LIFECYCLE: "plugin:lifecycle",
  PLUGIN_READINESS: "plugin:readiness",
  PLUGIN_GET_AUTH_STATUS: "plugin:get-auth-status",
  PLUGIN_SAVE_AUTH: "plugin:save-auth",
  PLUGIN_CLEAR_AUTH: "plugin:clear-auth",
  CODEX_AUTH_LOGOUT: "codex:auth-logout",
  PLUGIN_REVEAL_PERMISSION_SETTINGS: "plugin:reveal-permission-settings",
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

export type PluginGetRuntimeLogsParams = {
  readonly pluginId?: string
  readonly limit?: number
}

export type PluginStartParams = {
  readonly pluginId: string
}

export type PluginStopParams = {
  readonly pluginId: string
}

export type PluginRetryParams = {
  readonly pluginId: string
  readonly retryClass: PluginRetryClass
}

export type PluginRetryClass =
  | "retry_bridge_start"
  | "retry_permission"
  | "retry_plugin_start"

export type PluginGetAuthStatusParams = {
  readonly pluginId: string
}

export type PluginRevealPermissionSettingsParams = {
  readonly pluginId: string
}

export type PluginSaveAuthParams = {
  readonly pluginId: string
  readonly values: Record<string, string>
}

export type FileDialogFilter = {
  readonly name: string
  readonly extensions: string[]
}

export type SelectAttachmentsParams = {
  readonly filters?: readonly FileDialogFilter[]
}

export type AttachmentMetadataLookupParams = {
  readonly paths: readonly string[]
}

export type RevealFileInFolderParams = {
  readonly path: string
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
  | "invalid_retry_class"

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

export type PluginReadinessEvent = {
  readonly pluginId: string
  readonly readiness: ExtensionRuntimeReadiness
  readonly previousReadiness?: ExtensionRuntimeReadiness
  readonly lastError?: string
  readonly retryClass?: PluginRetryClass
  readonly emittedAt: string
}

export type PluginRuntimeLogEntry = {
  readonly pluginId: string
  readonly source: "bridge" | "mcp"
  readonly message: string
  readonly emittedAt: string
  readonly readiness?: ExtensionRuntimeReadiness
  readonly lifecycleStatus?: ExtensionLifecycleStatus
  readonly retryClass?: PluginRetryClass
  readonly correlationId?: string
}

export type PluginRuntimeLogsResult = {
  readonly entries: readonly PluginRuntimeLogEntry[]
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

export type PluginRevealPermissionSettingsFailureReason =
  | "unsupported_plugin"
  | "platform_unsupported"
  | "open_failed"

export type PluginRevealPermissionSettingsResult =
  | {
    readonly ok: true
    readonly pluginId: string
  }
  | {
    readonly ok: false
    readonly pluginId: string
    readonly reason: PluginRevealPermissionSettingsFailureReason
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
  [IpcChannel.FILE_SELECT_ATTACHMENTS]: [params?: SelectAttachmentsParams]
  [IpcChannel.FILE_GET_ATTACHMENT_METADATA]: [params: AttachmentMetadataLookupParams]
  [IpcChannel.FILE_SAVE_DIALOG]: [options?: { defaultPath?: string }]
  [IpcChannel.FILE_REVEAL_IN_FOLDER]: [params: RevealFileInFolderParams]
  [IpcChannel.CODEX_AUTH_START]: []
  [IpcChannel.CODEX_AUTH_STATUS]: []
  [IpcChannel.PUSH_GET_SETTINGS]: []
  [IpcChannel.PUSH_UPDATE_SETTINGS]: [params: UpdatePhonePushSettingsParams]
  [IpcChannel.PUSH_START_PAIRING]: []
  [IpcChannel.PUSH_GET_PAIRING_STATUS]: []
  [IpcChannel.PUSH_CANCEL_PAIRING]: []
  [IpcChannel.PUSH_SEND_TEST]: []
  [IpcChannel.PUSH_UNLINK_DEVICE]: []
  [IpcChannel.PLUGIN_LIST]: []
  [IpcChannel.PLUGIN_START]: [params: PluginStartParams]
  [IpcChannel.PLUGIN_STOP]: [params: PluginStopParams]
  [IpcChannel.PLUGIN_RETRY]: [params: PluginRetryParams]
  [IpcChannel.PLUGIN_INSTALL_BUNDLED]: [params: PluginInstallBundledParams]
  [IpcChannel.PLUGIN_SET_ENABLED]: [params: PluginSetEnabledParams]
  [IpcChannel.PLUGIN_UNINSTALL]: [params: PluginUninstallParams]
  [IpcChannel.PLUGIN_GET_STATUS]: [params: PluginGetStatusParams]
  [IpcChannel.PLUGIN_GET_RUNTIME_LOGS]: [params?: PluginGetRuntimeLogsParams]
  [IpcChannel.PLUGIN_GET_AUTH_STATUS]: [params: PluginGetAuthStatusParams]
  [IpcChannel.PLUGIN_SAVE_AUTH]: [params: PluginSaveAuthParams]
  [IpcChannel.PLUGIN_CLEAR_AUTH]: [params: { pluginId: string }]
  [IpcChannel.CODEX_AUTH_LOGOUT]: []
  [IpcChannel.PLUGIN_REVEAL_PERMISSION_SETTINGS]: [params: PluginRevealPermissionSettingsParams]
}

export type IpcInvokeResultMap = {
  [IpcChannel.APP_GET_PATH]: string
  [IpcChannel.APP_GET_BOOTSTRAP]: DesktopBootstrap
  [IpcChannel.NOTIFICATION_SHOW]: void
  [IpcChannel.TRAY_UPDATE_BADGE]: void
  [IpcChannel.FILE_OPEN_DIALOG]: string | null
  [IpcChannel.FILE_SELECT_ATTACHMENTS]: string[] | null
  [IpcChannel.FILE_GET_ATTACHMENT_METADATA]: TurnAttachmentInput[]
  [IpcChannel.FILE_SAVE_DIALOG]: string | null
  [IpcChannel.FILE_REVEAL_IN_FOLDER]: boolean
  [IpcChannel.CODEX_AUTH_START]: CodexAuthResult
  [IpcChannel.CODEX_AUTH_STATUS]: { status: "pending" | "connected" | "failed"; error?: string }
  [IpcChannel.PUSH_GET_SETTINGS]: PhonePushSettings
  [IpcChannel.PUSH_UPDATE_SETTINGS]: PhonePushSettings
  [IpcChannel.PUSH_START_PAIRING]: PushPairingSession
  [IpcChannel.PUSH_GET_PAIRING_STATUS]: PushPairingStatusResult
  [IpcChannel.PUSH_CANCEL_PAIRING]: PhonePushSettings
  [IpcChannel.PUSH_SEND_TEST]: PushSendTestResult
  [IpcChannel.PUSH_UNLINK_DEVICE]: PhonePushSettings
  [IpcChannel.PLUGIN_LIST]: ExtensionRegistryEntry[]
  [IpcChannel.PLUGIN_START]: PluginLifecycleActionResult
  [IpcChannel.PLUGIN_STOP]: PluginLifecycleActionResult
  [IpcChannel.PLUGIN_RETRY]: PluginLifecycleActionResult
  [IpcChannel.PLUGIN_INSTALL_BUNDLED]: PluginManagementActionResult
  [IpcChannel.PLUGIN_SET_ENABLED]: PluginManagementActionResult
  [IpcChannel.PLUGIN_UNINSTALL]: PluginManagementActionResult
  [IpcChannel.PLUGIN_GET_STATUS]: ExtensionRegistryEntry | null
  [IpcChannel.PLUGIN_GET_RUNTIME_LOGS]: PluginRuntimeLogsResult
  [IpcChannel.PLUGIN_GET_AUTH_STATUS]: PluginAuthStatus | null
  [IpcChannel.PLUGIN_SAVE_AUTH]: PluginSaveAuthResult
  [IpcChannel.PLUGIN_CLEAR_AUTH]: { ok: boolean }
  [IpcChannel.CODEX_AUTH_LOGOUT]: { ok: boolean }
  [IpcChannel.PLUGIN_REVEAL_PERMISSION_SETTINGS]: PluginRevealPermissionSettingsResult
}

export type IpcEventPayloadMap = {
  [IpcChannel.PLUGIN_LIFECYCLE]: PluginLifecycleEvent
  [IpcChannel.PLUGIN_READINESS]: PluginReadinessEvent
}
