import type { CronJob } from "@orbyt/contracts"
import type { CronStoreShape } from "./store.js"

export interface CreateReminderInput {
  readonly at: string
  readonly title: string
  readonly body: string
}

export interface CreateReminderResult {
  readonly ok: true
  readonly job: CronJob
}

export interface CreateReminderRejection {
  readonly ok: false
  readonly reason: string
}

/**
 * Public API that turns a parsed reminder directive into a one-shot cron job.
 *
 * Validates that:
 *   - `at` parses as a valid future timestamp
 *   - title and body are non-empty
 *
 * The agent reaches this through the daily-insight executor (which parses
 * REMINDER: lines from the model output) and through any reactive turn that
 * registers `cron_reminder_create` in its tool registry.
 */
export function createReminderJob(
  store: CronStoreShape,
  input: CreateReminderInput,
  now: number = Date.now(),
): CreateReminderResult | CreateReminderRejection {
  const trimmedTitle = input.title.trim()
  const trimmedBody = input.body.trim()
  if (trimmedTitle.length === 0) {
    return { ok: false, reason: "title is required" }
  }
  if (trimmedBody.length === 0) {
    return { ok: false, reason: "body is required" }
  }

  const fireMs = Date.parse(input.at)
  if (!Number.isFinite(fireMs)) {
    return { ok: false, reason: `at: not a valid timestamp (${input.at})` }
  }
  if (fireMs <= now) {
    return { ok: false, reason: `at: must be in the future (got ${input.at})` }
  }

  const job = store.createJob({
    name: `reminder-${trimmedTitle.slice(0, 32)}`,
    scheduleKind: "at",
    scheduleValue: new Date(fireMs).toISOString(),
    payloadKind: "reminder",
    payloadContent: JSON.stringify({ title: trimmedTitle, body: trimmedBody }),
    nextRunAt: fireMs,
    deleteAfterRun: true,
  })

  return { ok: true, job }
}
