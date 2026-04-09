export const IpcChannel = {
  APP_GET_PATH: "app:get-path",
  APP_GET_BOOTSTRAP: "app:get-bootstrap",
  NOTIFICATION_SHOW: "notification:show",
  TRAY_UPDATE_BADGE: "tray:update-badge",
  FILE_OPEN_DIALOG: "file:open-dialog",
  FILE_SAVE_DIALOG: "file:save-dialog",
} as const

export type IpcChannel = (typeof IpcChannel)[keyof typeof IpcChannel]

export type IpcPayloadMap = {
  [IpcChannel.APP_GET_PATH]: { path: string }
  [IpcChannel.APP_GET_BOOTSTRAP]: { wsUrl: string; appVersion: string; platform: string }
  [IpcChannel.NOTIFICATION_SHOW]: { title: string; body: string }
  [IpcChannel.TRAY_UPDATE_BADGE]: { count: number }
  [IpcChannel.FILE_OPEN_DIALOG]: { filters?: Array<{ name: string; extensions: string[] }> }
  [IpcChannel.FILE_SAVE_DIALOG]: { defaultPath?: string }
}
