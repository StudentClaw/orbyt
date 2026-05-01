import { Context, Effect, Layer } from "effect"
import { PUSH_CHANNELS, type ActivityFeedEntry, type CronJob } from "@orbyt/contracts"
import { Database } from "../db/Database.js"
import { PushBus } from "../ws/PushBus.js"
import { recordActivityEntry } from "../activity/feed.js"
import { simplifyCourseCode } from "./course-code.js"

export interface DeliverySuccessInput {
  readonly job: CronJob
  readonly output: string
}

export interface DeliveryFailureInput {
  readonly job: CronJob
  readonly error: string
}

export interface CronDeliveryShape {
  readonly deliverSuccess: (input: DeliverySuccessInput) => Promise<void>
  readonly deliverFailure: (input: DeliveryFailureInput) => Promise<void>
}

export class CronDelivery extends Context.Tag("CronDelivery")<
  CronDelivery,
  CronDeliveryShape
>() {}

interface ReminderShape {
  readonly title: string
  readonly body: string
}

function safeParseReminder(raw: string): ReminderShape | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ReminderShape>
    if (typeof parsed.title === "string" && typeof parsed.body === "string") {
      return { title: parsed.title, body: parsed.body }
    }
    return null
  } catch {
    return null
  }
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`
}

const COURSE_CODE_TOKEN = /\b[A-Za-z0-9]+_[A-Za-z0-9]+_[A-Za-z0-9_]+\b/g

/**
 * Apply the project-wide course-code rule to user-facing text. Any token that
 * looks like `TERM_CODE_TITLE` collapses to the middle segment. The simplifier
 * is conservative: tokens that don't match the pattern are left alone.
 */
function normalizeCourseCodes(text: string): string {
  return text.replace(COURSE_CODE_TOKEN, (match) => simplifyCourseCode(match))
}

const REMINDER_TITLE = "Orby"

const NAME_HEARTBEAT = "heartbeat"
const NAME_DAILY_INSIGHT = "daily-insight"
const NAME_CANVAS_SYNC = "canvas-sync"

// CanvasAuthError happens when the user hasn't configured Canvas creds yet —
// expected during onboarding and not actionable from the activity feed.
function isCanvasAuthError(error: string): boolean {
  return error.includes("CanvasAuthError") || error.includes("Canvas credentials not configured")
}

function entryFromSuccess(
  input: DeliverySuccessInput,
): Omit<ActivityFeedEntry, "id"> | null {
  const { job, output } = input

  if (job.payloadKind === "reminder") {
    const reminder = safeParseReminder(job.payloadContent)
    const rawBody = reminder?.body ?? reminder?.title ?? job.name
    return {
      category: "reminder",
      type: "reminder.fired",
      title: REMINDER_TITLE,
      body: normalizeCourseCodes(rawBody).trim(),
      notify: true,
      priority: 2,
    }
  }

  // Heartbeat and daily-insight write their entries directly inside the
  // executor (where they have access to candidate metadata, deep links, and
  // dedupe state). Skipping here prevents duplicate / generic cards.
  if (job.name === NAME_HEARTBEAT || job.name === NAME_DAILY_INSIGHT) {
    return null
  }

  return {
    category: "cron",
    type: `${job.name}.completed`,
    title: job.name,
    body: truncate(output, 240),
    notify: true,
    priority: 3,
  }
}

function entryFromFailure(
  input: DeliveryFailureInput,
): Omit<ActivityFeedEntry, "id"> | null {
  const { job, error } = input

  // Don't pollute the feed with credential-not-configured noise. The Settings
  // → Plugins surface is where the user fixes this; an activity card adds no
  // signal once they've already saved creds.
  if (job.name === NAME_CANVAS_SYNC && isCanvasAuthError(error)) {
    return null
  }

  return {
    category: "cron",
    type: `${job.name}.failed`,
    title: `${job.name} failed`,
    body: truncate(error, 240),
    notify: false,
    priority: 1,
  }
}

export const CronDeliveryLive = Layer.effect(
  CronDelivery,
  Effect.gen(function* () {
    const database = yield* Database
    const pushBus = yield* PushBus

    const dismissStaleCanvasSyncFailures = (): void => {
      database.execute(
        `UPDATE activity_feed
            SET acted_on = 1, acted_at = ?
          WHERE type = 'canvas-sync.failed'
            AND acted_on IS NULL`,
        [Date.now()],
      )
    }

    const deliverSuccess: CronDeliveryShape["deliverSuccess"] = async (input) => {
      // A successful canvas-sync invalidates any prior failure cards (typically
      // CanvasAuthError from before the user saved creds). Clear them so the
      // feed reflects current state.
      if (input.job.name === NAME_CANVAS_SYNC) {
        dismissStaleCanvasSyncFailures()
      }
      const entry = entryFromSuccess(input)
      if (!entry) return
      await recordActivityEntry({ database, pushBus, entry })
    }

    const deliverFailure: CronDeliveryShape["deliverFailure"] = async (input) => {
      const entry = entryFromFailure(input)
      if (!entry) return
      await recordActivityEntry({ database, pushBus, entry })
    }

    return { deliverSuccess, deliverFailure }
  }),
)

export { PUSH_CHANNELS }
