import { useState } from "react"
import type { OnboardingStepProps } from "./OnboardingWizard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const STUDY_TIME_OPTIONS = ["Morning", "Afternoon", "Evening"] as const
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
const DURATION_OPTIONS = [30, 60, 90, 120, 150, 180] as const

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

export function PreferencesStep(_props: OnboardingStepProps) {
  const [studyTimes, setStudyTimes] = useState<ReadonlySet<string>>(new Set())
  const [maxDuration, setMaxDuration] = useState(90)
  const [offDays, setOffDays] = useState<ReadonlySet<number>>(new Set())
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [quietStart, setQuietStart] = useState("22:00")
  const [quietEnd, setQuietEnd] = useState("08:00")

  const toggleStudyTime = (time: string) => {
    const next = new Set(studyTimes)
    if (next.has(time)) {
      next.delete(time)
    } else {
      next.add(time)
    }
    setStudyTimes(next)
  }

  const toggleOffDay = (dayIndex: number) => {
    const next = new Set(offDays)
    if (next.has(dayIndex)) {
      next.delete(dayIndex)
    } else {
      next.add(dayIndex)
    }
    setOffDays(next)
  }

  return (
    <Card data-testid="preferences-step">
      <CardHeader>
        <CardTitle className="text-lg">Study Preferences</CardTitle>
        <CardDescription>
          Tell us when and how you prefer to study.
        </CardDescription>
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
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((d) => (
              <Button
                key={d}
                variant={maxDuration === d ? "default" : "outline"}
                size="sm"
                onClick={() => setMaxDuration(d)}
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
          <div className="flex items-center gap-3" data-testid="pref-notif-switch">
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={setNotificationsEnabled}
            />
            <Label>Enable notifications</Label>
          </div>
          {notificationsEnabled && (
            <div className="flex items-center gap-3 pl-10">
              <Label className="shrink-0 text-sm">Quiet hours:</Label>
              <Input
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                className="w-28"
                data-testid="pref-quiet-start"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                className="w-28"
                data-testid="pref-quiet-end"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
