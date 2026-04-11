import { useEffect, useState } from "react"
import type { OnboardingStepProps } from "./OnboardingWizard"
import { getPrimaryWsRpcClient } from "@/rpc/appRuntime"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 6 AM to 9 PM

function formatHour(hour: number): string {
  if (hour === 0 || hour === 12) return hour === 0 ? "12a" : "12p"
  return hour < 12 ? `${hour}a` : `${hour - 12}p`
}

export function RoutinesStep(_props: OnboardingStepProps) {
  const [activeCells, setActiveCells] = useState<ReadonlySet<string>>(new Set())

  // Fire-and-forget sync to server whenever the grid changes
  useEffect(() => {
    const cells = Array.from(activeCells).map((key) => {
      const [day, hour] = key.split("-").map(Number)
      return { dayOfWeek: day, hourOfDay: hour }
    })
    try {
      void getPrimaryWsRpcClient().onboarding.setRoutines({ cells }).catch(() => undefined)
    } catch {
      // Runtime not yet initialised — skip sync, server will hydrate on connect
    }
  }, [activeCells])

  const toggleCell = (day: number, hour: number) => {
    const key = `${day}-${hour}`
    const next = new Set(activeCells)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    setActiveCells(next)
  }

  return (
    <Card data-testid="routines-step">
      <CardHeader>
        <CardTitle className="text-lg">Weekly Routines</CardTitle>
        <CardDescription>
          Mark your recurring commitments (classes, work, etc.) so we avoid scheduling study sessions during those times.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="overflow-auto"
          data-testid="routines-grid"
        >
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="w-12 p-1" />
                {DAY_LABELS.map((day) => (
                  <th key={day} className="p-1 text-center font-medium">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour) => (
                <tr key={hour}>
                  <td className="p-1 text-right text-muted-foreground">
                    {formatHour(hour)}
                  </td>
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
  )
}
