import { IpcChannel } from "@orbyt/contracts"

type DesktopNotificationOptions = {
  title: string
  body?: string
}

type NormalizedDesktopNotification = {
  title: string
  body: string
}

function normalizeNotification(
  options: DesktopNotificationOptions,
): NormalizedDesktopNotification {
  return {
    title: options.title,
    body: options.body ?? "",
  }
}

function hasWebNotificationSupport(): boolean {
  return typeof window !== "undefined" && typeof window.Notification !== "undefined"
}

async function showRendererNotification(
  notification: NormalizedDesktopNotification,
  requestPermission: boolean,
): Promise<boolean> {
  if (!hasWebNotificationSupport()) {
    return false
  }

  let permission = window.Notification.permission

  if (
    requestPermission
    && permission === "default"
    && typeof window.Notification.requestPermission === "function"
  ) {
    permission = await window.Notification.requestPermission()
  }

  if (permission === "granted") {
    new window.Notification(notification.title, {
      body: notification.body,
    })
    return true
  }

  if (requestPermission) {
    throw new Error("Desktop notifications are blocked. Allow them for Orbyt and try again.")
  }

  return false
}

async function showElectronNotification(notification: NormalizedDesktopNotification): Promise<boolean> {
  if (!window.electronAPI?.invoke) {
    return false
  }

  await window.electronAPI.invoke(IpcChannel.NOTIFICATION_SHOW, notification)
  return true
}

export async function requestDesktopNotification(options: DesktopNotificationOptions): Promise<void> {
  const notification = normalizeNotification(options)
  const shown = await showRendererNotification(notification, true)

  if (shown) {
    return
  }

  if (await showElectronNotification(notification)) {
    return
  }

  throw new Error("Desktop notifications are unavailable in this environment.")
}

export async function showDesktopNotification(options: DesktopNotificationOptions): Promise<void> {
  const notification = normalizeNotification(options)
  const shown = await showRendererNotification(notification, false)

  if (shown) {
    return
  }

  await showElectronNotification(notification)
}
