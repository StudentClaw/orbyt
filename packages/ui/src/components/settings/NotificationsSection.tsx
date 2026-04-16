import { useEffect, useState } from "react"
import * as QRCode from "qrcode"
import { IpcChannel, type PhonePushSettings } from "@student-claw/contracts"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { requestDesktopNotification } from "@/lib/nativeNotification"

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
] as const

const DESKTOP_TEST_NOTIFICATION = {
  title: "Student Claw test notification",
  body: "Desktop notifications are enabled for this app.",
} as const

function isRelayConfigured(settings: PhonePushSettings | null): boolean {
  return Boolean(settings?.relayBaseUrl.trim())
}

export function NotificationsSection() {
  const [pushSettings, setPushSettings] = useState<PhonePushSettings | null>(null)
  const [pushSettingsState, setPushSettingsState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [pushError, setPushError] = useState<string | null>(null)
  const [pendingPushAction, setPendingPushAction] = useState<string | null>(null)
  const [pushQrCodeUrl, setPushQrCodeUrl] = useState<string | null>(null)
  const [preferencesOpen, setPreferencesOpen] = useState(false)

  const relayConfigured = isRelayConfigured(pushSettings)
  const isLinked = Boolean(pushSettings?.linkedDevice)
  const isPairing = pushSettings?.activePairing?.state === "pending"
  const setupRequired = Boolean(pushSettings && !relayConfigured && !isLinked && !isPairing)
  const loadError = pushSettingsState === "error" ? pushError : null
  const adminError = pushSettingsState === "error" ? null : pushError

  async function refreshPushSettings(): Promise<void> {
    if (!window.electronAPI?.invoke) {
      setPushSettingsState("error")
      setPushError("Desktop bridge unavailable for phone push settings.")
      return
    }

    setPushSettingsState("loading")
    setPushError(null)

    try {
      const nextSettings = await window.electronAPI.invoke(IpcChannel.PUSH_GET_SETTINGS)
      setPushSettings(nextSettings)
      setPushSettingsState("ready")
    } catch (error) {
      setPushSettingsState("error")
      setPushError(error instanceof Error ? error.message : String(error))
    }
  }

  async function updatePushSettings(
    params: Parameters<NonNullable<Window["electronAPI"]>["invoke"]>[1],
  ): Promise<void> {
    if (!window.electronAPI?.invoke) {
      setPushError("Desktop bridge unavailable for phone push settings.")
      return
    }

    setPendingPushAction("update")
    setPushError(null)

    try {
      const nextSettings = await window.electronAPI.invoke(IpcChannel.PUSH_UPDATE_SETTINGS, params as never)
      setPushSettings(nextSettings)
    } catch (error) {
      setPushError(error instanceof Error ? error.message : String(error))
    } finally {
      setPendingPushAction(null)
    }
  }

  async function startPairing(): Promise<void> {
    if (!window.electronAPI?.invoke) {
      return
    }

    setPendingPushAction("pair")
    setPushError(null)

    try {
      const session = await window.electronAPI.invoke(IpcChannel.PUSH_START_PAIRING)
      setPushSettings((current) => current
        ? {
            ...current,
            activePairing: session,
          }
        : current)
    } catch (error) {
      setPushError(error instanceof Error ? error.message : String(error))
    } finally {
      setPendingPushAction(null)
    }
  }

  async function cancelPairing(): Promise<void> {
    if (!window.electronAPI?.invoke) {
      return
    }

    setPendingPushAction("cancel")

    try {
      const nextSettings = await window.electronAPI.invoke(IpcChannel.PUSH_CANCEL_PAIRING)
      setPushSettings(nextSettings)
    } catch (error) {
      setPushError(error instanceof Error ? error.message : String(error))
    } finally {
      setPendingPushAction(null)
    }
  }

  async function unlinkPhone(): Promise<void> {
    if (!window.electronAPI?.invoke) {
      return
    }

    setPendingPushAction("unlink")

    try {
      const nextSettings = await window.electronAPI.invoke(IpcChannel.PUSH_UNLINK_DEVICE)
      setPushSettings(nextSettings)
    } catch (error) {
      setPushError(error instanceof Error ? error.message : String(error))
    } finally {
      setPendingPushAction(null)
    }
  }

  async function sendTestNotification(): Promise<void> {
    if (!window.electronAPI?.invoke) {
      return
    }

    setPendingPushAction("test")
    setPushError(null)

    try {
      await window.electronAPI.invoke(IpcChannel.PUSH_SEND_TEST)
    } catch (error) {
      setPushError(error instanceof Error ? error.message : String(error))
    } finally {
      setPendingPushAction(null)
    }
  }

  async function sendDesktopTestNotification(): Promise<void> {
    setPendingPushAction("desktop-test")
    setPushError(null)

    try {
      await requestDesktopNotification(DESKTOP_TEST_NOTIFICATION)
    } catch (error) {
      setPushError(error instanceof Error ? error.message : String(error))
    } finally {
      setPendingPushAction(null)
    }
  }

  useEffect(() => {
    void refreshPushSettings()
  }, [])

  useEffect(() => {
    if (!pushSettings?.linkedDevice) {
      setPreferencesOpen(false)
    }
  }, [pushSettings?.linkedDevice])

  useEffect(() => {
    if (!pushSettings?.activePairing?.qrUrl) {
      setPushQrCodeUrl(null)
      return
    }

    let cancelled = false
    QRCode.toDataURL(pushSettings.activePairing.qrUrl, { margin: 1, width: 256 })
      .then((nextUrl: string) => {
        if (!cancelled) {
          setPushQrCodeUrl(nextUrl)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPushQrCodeUrl(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [pushSettings?.activePairing?.qrUrl])

  useEffect(() => {
    if (pushSettings?.activePairing?.state !== "pending" || !window.electronAPI?.invoke) {
      return
    }

    const interval = window.setInterval(() => {
      window.electronAPI?.invoke(IpcChannel.PUSH_GET_PAIRING_STATUS)
        .then((status) => {
          setPushSettings((current) => current
            ? {
                ...current,
                linkedDevice: status.linkedDevice,
                activePairing: status.activePairing,
              }
            : current)
        })
        .catch((error) => {
          setPushError(error instanceof Error ? error.message : String(error))
        })
    }, 2000)

    return () => {
      window.clearInterval(interval)
    }
  }, [pushSettings?.activePairing?.sessionId, pushSettings?.activePairing?.state])

  const statusLabel = isLinked
    ? `Linked · ${pushSettings?.linkedDevice?.platform ?? "phone"}`
    : isPairing
      ? "Pairing"
      : setupRequired
        ? "Setup required"
        : "Not linked"

  const statusBadgeClassName = setupRequired
    ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
    : undefined

  const statusBadgeVariant = setupRequired || !isLinked ? "outline" : "default"

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage desktop alerts, phone push notifications, and quiet hours.
        </p>
      </div>

      <Card data-testid="settings-push-card">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Phone Notifications</CardTitle>
              <CardDescription>
                {isLinked
                  ? "Your phone is linked and ready for direct push alerts from this desktop app."
                  : isPairing
                    ? "Scan the QR code on your phone to finish linking notifications."
                    : setupRequired
                      ? "Finish the desktop setup below, then pairing becomes one click."
                      : "Get alerts on your phone when work finishes."}
              </CardDescription>
            </div>
            <Badge
              variant={statusBadgeVariant}
              className={statusBadgeClassName}
              data-testid="settings-push-status"
            >
              {statusLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {pushSettingsState === "loading" && !pushSettings && (
            <p className="text-sm text-muted-foreground">Loading phone notification settings…</p>
          )}

          {loadError && (
            <Alert variant="destructive" data-testid="settings-push-error">
              <AlertTitle>Phone notifications unavailable</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {pushSettings && (
            <>
              {!isLinked && !isPairing && (
                <div className="rounded-2xl border p-4" data-testid="settings-push-main-flow">
                  <div className="space-y-1">
                    <p className="text-base font-medium">
                      {setupRequired ? "Desktop setup required" : "Ready to link your phone"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {setupRequired
                        ? "Phone notifications are not configured on this desktop yet."
                        : "Get alerts on your phone when work finishes."}
                    </p>
                  </div>

                  {setupRequired && (
                    <div
                      className="mt-4 rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-3"
                      data-testid="settings-push-setup-state"
                    >
                      <p className="text-sm text-muted-foreground">
                        Add the relay URL in Admin Setup below. Once that is saved, pairing becomes a single click.
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      onClick={() => { void startPairing() }}
                      disabled={!relayConfigured || pendingPushAction === "pair"}
                      data-testid="settings-push-pair"
                    >
                      Pair Phone
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      You&apos;ll scan a QR code on your phone and allow notifications.
                    </p>
                  </div>
                </div>
              )}

              {isPairing && pushSettings.activePairing && (
                <div className="space-y-4 rounded-2xl border p-4" data-testid="settings-push-pairing">
                  <div className="space-y-1">
                    <p className="text-base font-medium">Waiting for phone…</p>
                    <p className="text-sm text-muted-foreground">
                      Scan the QR code on your phone and approve notifications to finish linking.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires at {new Date(pushSettings.activePairing.expiresAt).toLocaleString()}.
                    </p>
                  </div>
                  {pushQrCodeUrl && (
                    <img
                      src={pushQrCodeUrl}
                      alt="Pair phone QR code"
                      className="h-44 w-44 rounded-xl border bg-white p-2"
                      data-testid="settings-push-qr"
                    />
                  )}
                  <a
                    href={pushSettings.activePairing.qrUrl}
                    className="break-all text-sm text-blue-600 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {pushSettings.activePairing.qrUrl}
                  </a>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => { void cancelPairing() }}
                      disabled={pendingPushAction === "cancel"}
                      data-testid="settings-push-cancel"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {isLinked && !isPairing && (
                <div className="space-y-4">
                  <div className="rounded-2xl border p-4" data-testid="settings-push-linked-state">
                    <div className="space-y-1">
                      <p className="text-base font-medium">Phone linked and ready.</p>
                      <p className="text-sm text-muted-foreground">
                        Workflow alerts and weekly insights can now go to your {pushSettings.linkedDevice?.platform ?? "linked"} phone.
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        onClick={() => { void startPairing() }}
                        disabled={!relayConfigured || pendingPushAction === "pair"}
                        data-testid="settings-push-pair"
                      >
                        Re-pair Phone
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { void unlinkPhone() }}
                        disabled={pendingPushAction === "unlink"}
                        data-testid="settings-push-unlink"
                      >
                        Unlink Phone
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-medium">Notification Preferences</p>
                        <p className="text-sm text-muted-foreground">
                          Fine-tune what gets sent after your phone is linked.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => { setPreferencesOpen((current) => !current) }}
                        data-testid="settings-push-preferences-toggle"
                      >
                        {preferencesOpen ? "Hide Preferences" : "Show Preferences"}
                      </Button>
                    </div>

                    {preferencesOpen && (
                      <div className="mt-4 space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="push-weekly-day">Weekly insight day</Label>
                            <select
                              id="push-weekly-day"
                              value={pushSettings.weeklyInsightsDay}
                              onChange={(event) => {
                                void updatePushSettings({ weeklyInsightsDay: Number(event.target.value) })
                              }}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              data-testid="settings-push-weekly-day"
                            >
                              {WEEKDAY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="push-weekly-time">Weekly insight time</Label>
                            <Input
                              id="push-weekly-time"
                              type="time"
                              value={pushSettings.weeklyInsightsTime}
                              onChange={(event) => {
                                void updatePushSettings({ weeklyInsightsTime: event.target.value })
                              }}
                              data-testid="settings-push-weekly-time"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Quiet hours</Label>
                          <div className="grid gap-4 md:grid-cols-2">
                            <Input
                              type="time"
                              value={pushSettings.quietHoursStart}
                              onChange={(event) => {
                                void updatePushSettings({ quietHoursStart: event.target.value })
                              }}
                              data-testid="settings-push-quiet-start"
                            />
                            <Input
                              type="time"
                              value={pushSettings.quietHoursEnd}
                              onChange={(event) => {
                                void updatePushSettings({ quietHoursEnd: event.target.value })
                              }}
                              data-testid="settings-push-quiet-end"
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between rounded-xl border p-3">
                            <div>
                              <Label htmlFor="push-enabled">Enable phone notifications</Label>
                              <p className="text-sm text-muted-foreground">Master switch for all mobile push sends.</p>
                            </div>
                            <Switch
                              id="push-enabled"
                              checked={pushSettings.enabled}
                              onCheckedChange={(checked) => {
                                void updatePushSettings({ enabled: checked })
                              }}
                              data-testid="settings-push-enabled"
                            />
                          </div>

                          <div className="flex items-center justify-between rounded-xl border p-3">
                            <div>
                              <Label htmlFor="push-workflow-enabled">Workflow completions</Label>
                              <p className="text-sm text-muted-foreground">Send high-priority workflow completion events.</p>
                            </div>
                            <Switch
                              id="push-workflow-enabled"
                              checked={pushSettings.workflowEventsEnabled}
                              onCheckedChange={(checked) => {
                                void updatePushSettings({ workflowEventsEnabled: checked })
                              }}
                              data-testid="settings-push-workflow-enabled"
                            />
                          </div>

                          <div className="flex items-center justify-between rounded-xl border p-3">
                            <div>
                              <Label htmlFor="push-weekly-enabled">Weekly insights</Label>
                              <p className="text-sm text-muted-foreground">Send the scheduled weekly insight summary.</p>
                            </div>
                            <Switch
                              id="push-weekly-enabled"
                              checked={pushSettings.weeklyInsightsEnabled}
                              onCheckedChange={(checked) => {
                                void updatePushSettings({ weeklyInsightsEnabled: checked })
                              }}
                              data-testid="settings-push-weekly-enabled"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div
        className="rounded-xl border border-dashed border-yellow-500/50 bg-yellow-500/5 p-4"
        data-testid="settings-push-admin-tools"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-yellow-600 dark:text-yellow-400">
              Admin Setup
            </p>
            <p className="text-sm text-muted-foreground">
              Visible by default in dev. This is the one-time desktop configuration behind one-click pairing.
            </p>
          </div>
          <Badge
            variant="outline"
            className={relayConfigured
              ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
              : "border-yellow-500/50 bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"}
          >
            {relayConfigured ? "Ready" : "Needs setup"}
          </Badge>
        </div>

        {adminError && (
          <Alert variant="destructive" className="mt-4" data-testid="settings-push-admin-error">
            <AlertTitle>Push setup needs attention</AlertTitle>
            <AlertDescription>{adminError}</AlertDescription>
          </Alert>
        )}

        {pushSettings && (
          <>
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="push-relay-base-url">Relay base URL</Label>
                <Input
                  id="push-relay-base-url"
                  value={pushSettings.relayBaseUrl}
                  onChange={(event) => {
                    void updatePushSettings({ relayBaseUrl: event.target.value })
                  }}
                  data-testid="settings-push-relay"
                />
                <p className="text-xs text-muted-foreground">
                  {relayConfigured
                    ? "Desktop setup is ready. Pairing from the main card is now one click."
                    : "Add the public relay/PWA URL here so phones can complete pairing."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button
                  variant="outline"
                  className="border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/10 hover:text-yellow-800 dark:text-yellow-300 dark:hover:bg-yellow-500/15 dark:hover:text-yellow-200"
                  onClick={() => { void sendDesktopTestNotification() }}
                  disabled={pendingPushAction === "desktop-test"}
                  data-testid="settings-desktop-send-test"
                >
                  Send Desktop Test
                </Button>
                <Button
                  variant="outline"
                  className="border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/10 hover:text-yellow-800 dark:text-yellow-300 dark:hover:bg-yellow-500/15 dark:hover:text-yellow-200"
                  onClick={() => { void sendTestNotification() }}
                  disabled={pendingPushAction === "test" || !isLinked}
                  data-testid="settings-push-send-test"
                >
                  Send Phone Test
                </Button>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {isLinked
                ? "Desktop tests fire immediately. Phone tests use the current linked phone subscription."
                : "Desktop tests work immediately. Link a phone first to enable direct phone notification testing."}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
