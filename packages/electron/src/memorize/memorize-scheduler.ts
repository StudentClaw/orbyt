import { FALLBACK_RUN_HOUR } from "@orbyt/contracts"

function slotForHour(reference: Date, hour: number): Date {
  const d = new Date(reference)
  d.setHours(hour, 0, 0, 0)
  return d
}

export function computeNextMemorizeRun(now: Date): Date {
  const today = slotForHour(now, FALLBACK_RUN_HOUR)
  if (today > now) return today
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return slotForHour(tomorrow, FALLBACK_RUN_HOUR)
}

export function computeMostRecentPassedSlot(now: Date): Date {
  const today = slotForHour(now, FALLBACK_RUN_HOUR)
  if (today <= now) return today
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  return slotForHour(yesterday, FALLBACK_RUN_HOUR)
}

export function memorizeRunNeeded(
  lastRunAt: Date | null,
  now: Date,
  graphFolderEmpty = false,
): boolean {
  if (graphFolderEmpty) return true
  const mostRecent = computeMostRecentPassedSlot(now)
  if (!lastRunAt) return true
  return lastRunAt < mostRecent
}

export interface MemorizeSchedulerOptions {
  readonly getLastRunAt: () => Date | null
  readonly onRun: () => Promise<void>
  readonly now?: () => Date
  readonly scheduleTimeout?: typeof setTimeout
  readonly clearScheduledTimeout?: typeof clearTimeout
}

export class MemorizeScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly options: MemorizeSchedulerOptions) {}

  start(): void {
    this.stop()
    const now = this.options.now?.() ?? new Date()
    const nextRun = computeNextMemorizeRun(now)
    const schedule = this.options.scheduleTimeout ?? setTimeout

    this.timer = schedule(() => {
      void this.tick()
    }, Math.max(0, nextRun.getTime() - now.getTime()))
  }

  stop(): void {
    if (this.timer) {
      ;(this.options.clearScheduledTimeout ?? clearTimeout)(this.timer)
      this.timer = null
    }
  }

  async runCatchUpIfNeeded(): Promise<void> {
    const now = this.options.now?.() ?? new Date()
    const lastRunAt = this.options.getLastRunAt()
    if (!memorizeRunNeeded(lastRunAt, now)) return
    await this.options.onRun()
  }

  private async tick(): Promise<void> {
    try {
      await this.options.onRun()
    } finally {
      this.start()
    }
  }
}
