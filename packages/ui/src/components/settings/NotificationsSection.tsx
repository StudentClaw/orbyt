import { useEffect, useState } from "react"
import { IpcChannel, type PhonePushSettings } from "@orbyt/contracts"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  title: "Orbyt test notification",
  body: "Desktop notifications are enabled for this app.",
} as const

export function NotificationsSection() {
  const [settings, setSettings] = useState<PhonePushSettings | null>(null)
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  async function refresh(): Promise<void> {
    if (!window.electronAPI?.invoke) {
      setState("error")
      setError("Desktop bridge unavailable for notification settings.")
      return
    }

    setState("loading")
    setError(null)

    try {
      const next = await window.electronAPI.invoke(IpcChannel.PUSH_GET_SETTINGS)
      setSettings(next)
      setState("ready")
    } catch (err) {
      setState("error")
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function update(
    params: Parameters<NonNullable<Window["electronAPI"]>["invoke"]>[1],
  ): Promise<void> {
    if (!window.electronAPI?.invoke) {
      setError("Desktop bridge unavailable for notification settings.")
      return
    }

    setPending("update")
    setError(null)

    try {
      const next = await window.electronAPI.invoke(IpcChannel.PUSH_UPDATE_SETTINGS, params as never)
      setSettings(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPending(null)
    }
  }

  async function sendDesktopTest(): Promise<void> {
    setPending("desktop-test")
    setError(null)

    try {
      await requestDesktopNotification(DESKTOP_TEST_NOTIFICATION)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPending(null)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Control desktop alerts, weekly insight delivery, and quiet hours.
        </p>
      </div>

      <Card data-testid="settings-push-card">
        <CardHeader>
          <CardTitle>Desktop Notifications</CardTitle>
          <CardDescription>
            Orbyt sends notifications through the macOS Notification Center.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && !settings && (
            <p className="text-sm text-muted-foreground">Loading notification settings…</p>
          )}

          {error && (
            <Alert variant="destructive" data-testid="settings-push-error">
              <AlertTitle>Notifications unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {settings && (
            <>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <Label htmlFor="push-enabled">Enable notifications</Label>
                  <p className="text-sm text-muted-foreground">Master switch for all desktop alerts.</p>
                </div>
                <Switch
                  id="push-enabled"
                  checked={settings.enabled}
                  onCheckedChange={(checked) => { void update({ enabled: checked }) }}
                  data-testid="settings-push-enabled"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <Label htmlFor="push-weekly-enabled">Weekly insights</Label>
                  <p className="text-sm text-muted-foreground">Send the scheduled weekly insight summary.</p>
                </div>
                <Switch
                  id="push-weekly-enabled"
                  checked={settings.weeklyInsightsEnabled}
                  onCheckedChange={(checked) => { void update({ weeklyInsightsEnabled: checked }) }}
                  data-testid="settings-push-weekly-enabled"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="push-weekly-day">Weekly insight day</Label>
                  <select
                    id="push-weekly-day"
                    value={settings.weeklyInsightsDay}
                    onChange={(event) => { void update({ weeklyInsightsDay: Number(event.target.value) }) }}
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
                    value={settings.weeklyInsightsTime}
                    onChange={(event) => { void update({ weeklyInsightsTime: event.target.value }) }}
                    data-testid="settings-push-weekly-time"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quiet hours</Label>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    type="time"
                    value={settings.quietHoursStart}
                    onChange={(event) => { void update({ quietHoursStart: event.target.value }) }}
                    data-testid="settings-push-quiet-start"
                  />
                  <Input
                    type="time"
                    value={settings.quietHoursEnd}
                    onChange={(event) => { void update({ quietHoursEnd: event.target.value }) }}
                    data-testid="settings-push-quiet-end"
                  />
                </div>
              </div>

              <div>
                <Button
                  variant="outline"
                  onClick={() => { void sendDesktopTest() }}
                  disabled={pending === "desktop-test"}
                  data-testid="settings-desktop-send-test"
                >
                  Send Desktop Test
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
