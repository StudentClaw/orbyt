import type { CronStoreShape } from "./store.js"
import { computeNextCronRunAt } from "./schedule-math.js"

const HEARTBEAT_NAME = "heartbeat"
const DAILY_INSIGHT_NAME = "daily-insight"

const HEARTBEAT_PROMPT_PLACEHOLDER =
  "(prompt is built dynamically by the executor from SOUL.md, HEARTBEAT.md, and the working buffer; this field is unused for the heartbeat job)"

const DAILY_INSIGHT_PROMPT_PLACEHOLDER =
  "(prompt is built dynamically by the executor; this field is wired in step 5)"

function nextHeartbeatRun(now: Date): number {
  // Run the first heartbeat ~5 minutes after seed, then every 30m thereafter.
  return now.getTime() + 5 * 60 * 1000
}

function nextDailyInsightRun(now: Date, tz: string): number {
  // Anchored to wall-clock 08:00 / 19:00 in the user's local timezone.
  const next = computeNextCronRunAt("0 8,19 * * *", tz, now.getTime())
  if (next !== null) return next
  // Fallback: tomorrow 08:00 local.
  const fallback = new Date(now)
  fallback.setHours(8, 0, 0, 0)
  if (fallback.getTime() <= now.getTime()) {
    fallback.setDate(fallback.getDate() + 1)
  }
  return fallback.getTime()
}

function resolveTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return "UTC"
  }
}

export interface SeedOptions {
  readonly now?: Date
  readonly includeDailyInsight?: boolean
}

/** Seeds the heartbeat (and optionally the daily-insight) job rows when none exist. */
export function seedDefaultJobs(
  store: CronStoreShape,
  options: SeedOptions = {},
): { heartbeatId?: string; dailyInsightId?: string } {
  const now = options.now ?? new Date()

  const existing = store.listJobs()
  const haveHeartbeat = existing.some((j) => j.name === HEARTBEAT_NAME)
  const haveDailyInsight = existing.some((j) => j.name === DAILY_INSIGHT_NAME)
  const out: { heartbeatId?: string; dailyInsightId?: string } = {}

  if (!haveHeartbeat) {
    const job = store.createJob({
      name: HEARTBEAT_NAME,
      scheduleKind: "every",
      scheduleValue: "30m",
      sessionTarget: "isolated",
      payloadKind: "agentTurn",
      payloadContent: HEARTBEAT_PROMPT_PLACEHOLDER,
      nextRunAt: nextHeartbeatRun(now),
    })
    out.heartbeatId = job.id
  }

  if (!haveDailyInsight && options.includeDailyInsight) {
    const tz = resolveTimezone()
    const job = store.createJob({
      name: DAILY_INSIGHT_NAME,
      scheduleKind: "cron",
      scheduleValue: "0 8,19 * * *",
      scheduleTz: tz,
      sessionTarget: "isolated",
      payloadKind: "agentTurn",
      payloadContent: DAILY_INSIGHT_PROMPT_PLACEHOLDER,
      nextRunAt: nextDailyInsightRun(now, tz),
    })
    out.dailyInsightId = job.id
  }

  return out
}
