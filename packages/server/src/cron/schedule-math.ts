import { CronExpressionParser } from "cron-parser"
import type { CronJob } from "@orbyt/contracts"

const EVERY_PATTERN = /^(\d+)([smh])$/i

const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
}

/** Parses an `every`-style shorthand like "30m", "10s", "2h" into milliseconds. */
export function parseEveryMs(value: string): number | null {
  const match = EVERY_PATTERN.exec(value.trim())
  if (!match) return null
  const amount = Number.parseInt(match[1] ?? "", 10)
  const unit = (match[2] ?? "").toLowerCase()
  const factor = UNIT_MS[unit]
  if (!Number.isFinite(amount) || amount <= 0 || !factor) return null
  return amount * factor
}

/** Parses an `at`-style schedule value (ISO timestamp) into unix ms. */
export function parseAtMs(value: string): number | null {
  const ms = Date.parse(value.trim())
  return Number.isFinite(ms) ? ms : null
}

/**
 * Computes the next fire time relative to a finish timestamp.
 *
 * - `at` jobs are one-shot: after firing they have no next run.
 * - `every` jobs anchor to the finish time, not the scheduled time, so a delayed
 *   run does not "catch up" by triple-firing.
 * - `cron` is left as `null` here; the cron-parser dependency is wired in a
 *   later step.
 */
export function computeNextRunAt(
  job: Pick<CronJob, "scheduleKind" | "scheduleValue" | "scheduleTz">,
  finishedAt: number,
): number | null {
  switch (job.scheduleKind) {
    case "at":
      return null
    case "every": {
      const intervalMs = parseEveryMs(job.scheduleValue)
      if (intervalMs === null) return null
      return finishedAt + intervalMs
    }
    case "cron":
      return computeNextCronRunAt(job.scheduleValue, job.scheduleTz, finishedAt)
    default:
      return null
  }
}

/** Computes the next fire time for a cron expression, anchored at `finishedAt`. */
export function computeNextCronRunAt(
  expression: string,
  tz: string | null,
  finishedAt: number,
): number | null {
  try {
    const interval = CronExpressionParser.parse(expression, {
      currentDate: new Date(finishedAt),
      tz: tz ?? undefined,
    })
    return interval.next().getTime()
  } catch {
    return null
  }
}

/** Validates a cron expression and returns the next N fire times for UI preview. */
export function previewCronFireTimes(
  expression: string,
  tz: string | null,
  count: number,
  from: number = Date.now(),
): { ok: true; fireTimes: ReadonlyArray<number> } | { ok: false; error: string } {
  try {
    const interval = CronExpressionParser.parse(expression, {
      currentDate: new Date(from),
      tz: tz ?? undefined,
    })
    const fireTimes: number[] = []
    for (let i = 0; i < count; i += 1) {
      fireTimes.push(interval.next().getTime())
    }
    return { ok: true, fireTimes }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
