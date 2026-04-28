import { Context, Effect, Layer } from "effect"
import { PUSH_CHANNELS, type ActivityFeedEntry, type CronJob } from "@orbyt/contracts"
import { Database } from "../db/Database.js"
import { PushBus } from "../ws/PushBus.js"
import { recordActivityEntry } from "../activity/feed.js"
import { checkHeartbeatAck } from "./prompts.js"

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

function entryFromSuccess(
  input: DeliverySuccessInput,
): Omit<ActivityFeedEntry, "id"> | null {
  const { job, output } = input

  if (job.payloadKind === "reminder") {
    const reminder = safeParseReminder(job.payloadContent)
    return {
      category: "reminder",
      type: "reminder.fired",
      title: reminder?.title ?? job.name,
      body: reminder?.body ?? "",
      notify: true,
      priority: 2,
    }
  }

  // Heartbeat: HEARTBEAT_OK + ≤300 chars => suppress entirely.
  if (job.name === "heartbeat") {
    const ack = checkHeartbeatAck(output)
    if (ack.suppress) return null
    const body = truncate(ack.remainder.length > 0 ? ack.remainder : output, 240)
    if (body.length === 0) return null
    return {
      category: "cron",
      type: "heartbeat.alert",
      title: "Heartbeat alert",
      body,
      notify: true,
      priority: 2,
    }
  }

  return {
    category: job.name === "daily-insight" ? "insight" : "cron",
    type: `${job.name}.completed`,
    title: job.name,
    body: truncate(output, 240),
    notify: true,
    priority: 3,
  }
}

function entryFromFailure(input: DeliveryFailureInput): Omit<ActivityFeedEntry, "id"> {
  const { job, error } = input
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

    const deliverSuccess: CronDeliveryShape["deliverSuccess"] = async (input) => {
      const entry = entryFromSuccess(input)
      if (!entry) return
      await recordActivityEntry({ database, pushBus, entry })
    }

    const deliverFailure: CronDeliveryShape["deliverFailure"] = async (input) => {
      const entry = entryFromFailure(input)
      await recordActivityEntry({ database, pushBus, entry })
    }

    return { deliverSuccess, deliverFailure }
  }),
)

export { PUSH_CHANNELS }
