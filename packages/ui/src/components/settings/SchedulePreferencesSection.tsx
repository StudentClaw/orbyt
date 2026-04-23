import { useEffect, useState } from "react"
import type { StudentPreference, CalendarIntegration } from "@orbyt/contracts"
import { waitForPrimaryWsRpcClient } from "@/rpc/appRuntime"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const STUDY_TIME_OPTIONS = ["Morning", "Afternoon", "Evening"] as const
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
const DURATION_OPTIONS = [30, 60, 90, 120, 150, 180] as const
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 6 AM to 9 PM

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

function formatHour(hour: number): string {
  if (hour === 0 || hour === 12) return hour === 0 ? "12a" : "12p"
  return hour < 12 ? `${hour}a` : `${hour - 12}p`
}

type LoadState = "loading" | "ready" | "error"

export function SchedulePreferencesSection() {
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [studyTimes, setStudyTimes] = useState<ReadonlySet<string>>(new Set())
  const [maxDuration, setMaxDuration] = useState(90)
  const [offDays, setOffDays] = useState<ReadonlySet<number>>(new Set())
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [quietStart, setQuietStart] = useState("22:00")
  const [quietEnd, setQuietEnd] = useState("08:00")
  const [calendarIntegration, setCalendarIntegration] = useState<CalendarIntegration>("none")
  const [activeCells, setActiveCells] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    void waitForPrimaryWsRpcClient()
      .then((client) => Promise.all([client.onboarding.getPreferences(), client.onboarding.getRoutines()]))
      .then(([prefs, routines]) => {
        if (cancelled) return
        setStudyTimes(new Set(prefs.studyTimes.map((t) => capitalize(t))))
        setMaxDuration(prefs.maxSessionMins)
        setOffDays(new Set(prefs.offLimitDays))
        setNotificationsEnabled(prefs.notificationEnabled)
        setQuietStart(prefs.quietHoursStart)
        setQuietEnd(prefs.quietHoursEnd)
        setCalendarIntegration(prefs.calendarIntegration)
        setActiveCells(new Set(routines.cells.map((c) => `${c.dayOfWeek}-${c.hourOfDay}`)))
        setLoadState("ready")
      })
      .catch(() => {
        if (!cancelled) setLoadState("error")
      })

    return () => { cancelled = true }
  }, [])

  function syncPreferences(patch: Partial<StudentPreference>) {
    void waitForPrimaryWsRpcClient()
      .then((client) => client.onboarding.setPreferences(patch))
      .catch(() => undefined)
  }

  function syncRoutines(cells: ReadonlySet<string>) {
    const parsed = Array.from(cells).map((key) => {
      const [day, hour] = key.split("-").map(Number)
      return { dayOfWeek: day, hourOfDay: hour }
    })

    void waitForPrimaryWsRpcClient()
      .then((client) => client.onboarding.setRoutines({ cells: parsed }))
      .catch(() => undefined)
  }

  const toggleStudyTime = (time: string) => {
    const next = new Set(studyTimes)
    if (next.has(time)) { next.delete(time) } else { next.add(time) }
    setStudyTimes(next)
    syncPreferences({ studyTimes: Array.from(next).map((t) => t.toLowerCase()) })
  }

  const toggleOffDay = (dayIndex: number) => {
    const next = new Set(offDays)
    if (next.has(dayIndex)) { next.delete(dayIndex) } else { next.add(dayIndex) }
    setOffDays(next)
    syncPreferences({ offLimitDays: Array.from(next) })
  }

  const handleMaxDuration = (d: number) => {
    setMaxDuration(d)
    syncPreferences({ maxSessionMins: d })
  }

  const handleNotificationsEnabled = (checked: boolean) => {
    setNotificationsEnabled(checked)
    syncPreferences({ notificationEnabled: checked })
  }

  const handleQuietStart = (value: string) => {
    setQuietStart(value)
    syncPreferences({ quietHoursStart: value })
  }

  const handleQuietEnd = (value: string) => {
    setQuietEnd(value)
    syncPreferences({ quietHoursEnd: value })
  }

  const handleCalendarIntegration = (value: CalendarIntegration) => {
    setCalendarIntegration(value)
    syncPreferences({ calendarIntegration: value })
  }

  const toggleCell = (day: number, hour: number) => {
    const key = `${day}-${hour}`
    const next = new Set(activeCells)
    if (next.has(key)) { next.delete(key) } else { next.add(key) }
    setActiveCells(next)
    syncRoutines(next)
  }

  if (loadState === "loading") {
    return (
      <div data-testid="schedule-prefs-loading" className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (loadState === "error") {
    return (
      <div data-testid="schedule-prefs-error" className="rounded-xl border border-destructive p-6 text-destructive">
        <p className="font-medium">Could not load your schedule preferences.</p>
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
      </div>
    )
  }

  return (
    <div data-testid="schedule-prefs-content" className="space-y-6">
      {/* Study Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Study Preferences</CardTitle>
          <CardDescription>When and how long you prefer to study. Changes save automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2" data-testid="pref-study-times">
            <Label>Preferred study times</Label>
            <div className="flex gap-2">
              {STUDY_TIME_OPTIONS.map((time) => (
                <Button
                  key={time}
                  variant={studyTimes.has(time) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleStudyTime(time)}
                >
                  {time}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2" data-testid="pref-max-duration">
            <Label>Max session duration: {formatDuration(maxDuration)}</Label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((d) => (
                <Button
                  key={d}
                  variant={maxDuration === d ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleMaxDuration(d)}
                >
                  {formatDuration(d)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2" data-testid="pref-off-days">
            <Label>Off-limit days</Label>
            <div className="flex gap-2">
              {DAY_LABELS.map((day, i) => (
                <Button
                  key={day}
                  variant={offDays.has(i) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleOffDay(i)}
                >
                  {day}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={handleNotificationsEnabled}
                data-testid="pref-notif-switch"
              />
              <Label>Enable notifications</Label>
            </div>
            {notificationsEnabled && (
              <div className="flex items-center gap-3 pl-10">
                <Label className="shrink-0 text-sm">Quiet hours:</Label>
                <Input
                  type="time"
                  value={quietStart}
                  onChange={(e) => handleQuietStart(e.target.value)}
                  className="w-28"
                  data-testid="pref-quiet-start"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={quietEnd}
                  onChange={(e) => handleQuietEnd(e.target.value)}
                  className="w-28"
                  data-testid="pref-quiet-end"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="calendar-integration">Calendar integration</Label>
            <select
              id="calendar-integration"
              value={calendarIntegration}
              onChange={(e) => handleCalendarIntegration(e.target.value as CalendarIntegration)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="pref-calendar"
            >
              <option value="none">None</option>
              <option value="google">Google Calendar</option>
              <option value="apple">Apple Calendar</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Routines */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Routines</CardTitle>
          <CardDescription>
            Mark recurring commitments (classes, work) so the planner avoids those times.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto" data-testid="routines-grid">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="w-12 p-1" />
                  {DAY_LABELS.map((day) => (
                    <th key={day} className="p-1 text-center font-medium">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour}>
                    <td className="p-1 text-right text-muted-foreground">{formatHour(hour)}</td>
                    {DAY_LABELS.map((_, dayIndex) => {
                      const key = `${dayIndex}-${hour}`
                      const isActive = activeCells.has(key)
                      return (
                        <td key={key} className="p-0.5">
                          <button
                            type="button"
                            className={`h-6 w-full rounded-sm border transition-colors ${
                              isActive
                                ? "border-primary bg-primary/20"
                                : "border-border bg-muted/30 hover:bg-muted"
                            }`}
                            onClick={() => toggleCell(dayIndex, hour)}
                            data-testid={`routine-cell-${dayIndex}-${hour}`}
                            data-active={isActive}
                            aria-label={`${DAY_LABELS[dayIndex]} ${formatHour(hour)}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
