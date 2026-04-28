import type { PhonePushSettings, WeeklyInsight } from "@orbyt/contracts"
import type { PushDeliveryService } from "./push-delivery-service.js"
import type { PushStore } from "./push-store.js"

function parseTime(value: string): { hours: number; minutes: number } {
  const [hours = "0", minutes = "0"] = value.split(":")
  return {
    hours: Number(hours),
    minutes: Number(minutes),
  }
}

function weekStart(reference: Date): Date {
  const start = new Date(reference)
  start.setHours(0, 0, 0, 0)
  const mondayOffset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - mondayOffset)
  return start
}

function isQuietHour(now: Date, quietStart: string, quietEnd: string): boolean {
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const toMinutes = (value: string): number => {
    const { hours, minutes } = parseTime(value)
    return hours * 60 + minutes
  }
  const start = toMinutes(quietStart)
  const end = toMinutes(quietEnd)

  if (start === end) {
    return false
  }

  if (start < end) {
    return currentMinutes >= start && currentMinutes < end
  }

  return currentMinutes >= start || currentMinutes < end
}

function computeWeeklyInsightRunForWeek(
  reference: Date,
  settings: Pick<PhonePushSettings, "weeklyInsightsDay" | "weeklyInsightsTime">,
  weekOffset = 0,
): Date {
  const start = weekStart(reference)
  const { hours, minutes } = parseTime(settings.weeklyInsightsTime)
  const dayOffset = Math.max(0, settings.weeklyInsightsDay - 1)
  start.setDate(start.getDate() + dayOffset + weekOffset * 7)
  start.setHours(hours, minutes, 0, 0)
  return start
}

export function computeWeeklyInsightRunAt(
  reference: Date,
  settings: Pick<PhonePushSettings, "weeklyInsightsDay" | "weeklyInsightsTime">,
): Date {
  const currentWeekRun = computeWeeklyInsightRunForWeek(reference, settings)
  return currentWeekRun > reference
    ? currentWeekRun
    : computeWeeklyInsightRunForWeek(reference, settings, 1)
}

export class WeeklyInsightScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly options: {
    readonly store: PushStore
    readonly now?: () => Date
    readonly scheduleTimeout?: typeof setTimeout
    readonly clearScheduledTimeout?: typeof clearTimeout
    readonly fetchWeeklyInsight: () => Promise<WeeklyInsight>
    readonly delivery: Pick<PushDeliveryService, "send">
    readonly onSent?: (weekKey: string) => void
  }) {}

  start(): void {
    this.stop()
    const settings = this.options.store.getSettings()
    if (!settings.enabled || !settings.weeklyInsightsEnabled) {
      return
    }

    const now = this.options.now?.() ?? new Date()
    const nextRun = computeWeeklyInsightRunAt(now, settings)
    const schedule = this.options.scheduleTimeout ?? setTimeout

    this.timer = schedule(() => {
      void this.sendCurrentInsight()
    }, Math.max(0, nextRun.getTime() - now.getTime()))
  }

  stop(): void {
    if (this.timer) {
      ;(this.options.clearScheduledTimeout ?? clearTimeout)(this.timer)
      this.timer = null
    }
  }

  async runCatchUpIfNeeded(): Promise<void> {
    const settings = this.options.store.getSettings()
    if (!settings.enabled || !settings.weeklyInsightsEnabled) {
      return
    }

    const now = this.options.now?.() ?? new Date()
    if (isQuietHour(now, settings.quietHoursStart, settings.quietHoursEnd)) {
      return
    }

    const scheduledAt = computeWeeklyInsightRunForWeek(now, settings)
    if (now < scheduledAt) {
      return
    }

    const lastWeekKey = this.options.store.getLastWeeklyInsightWeekKey()
    const currentInsight = await this.options.fetchWeeklyInsight()
    if (lastWeekKey === currentInsight.weekKey) {
      return
    }

    const result = await this.options.delivery.send({
      title: currentInsight.title,
      body: currentInsight.body,
      tag: `weekly-insight:${currentInsight.weekKey}`,
    })

    if (result.ok) {
      this.options.store.setLastWeeklyInsightWeekKey(currentInsight.weekKey)
      this.options.onSent?.(currentInsight.weekKey)
    }
  }

  private async sendCurrentInsight(): Promise<void> {
    try {
      await this.runCatchUpIfNeeded()
    } finally {
      this.start()
    }
  }
}
