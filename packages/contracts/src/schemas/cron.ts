import { Schema } from "@effect/schema"

export const CronScheduleKind = Schema.Literal("at", "every", "cron")
export type CronScheduleKind = Schema.Schema.Type<typeof CronScheduleKind>

export const CronSessionTarget = Schema.Literal("main", "isolated")
export type CronSessionTarget = Schema.Schema.Type<typeof CronSessionTarget>

export const CronPayloadKind = Schema.Literal("agentTurn", "reminder", "internalTask")
export type CronPayloadKind = Schema.Schema.Type<typeof CronPayloadKind>

export const CronRunStatus = Schema.Literal("running", "success", "failed")
export type CronRunStatus = Schema.Schema.Type<typeof CronRunStatus>

export const ReminderPayload = Schema.Struct({
  title: Schema.String,
  body: Schema.String,
})
export type ReminderPayload = Schema.Schema.Type<typeof ReminderPayload>

export const CronJob = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  scheduleKind: CronScheduleKind,
  scheduleValue: Schema.String,
  scheduleTz: Schema.NullOr(Schema.String),
  sessionTarget: Schema.NullOr(CronSessionTarget),
  payloadKind: CronPayloadKind,
  payloadContent: Schema.String,
  nextRunAt: Schema.NullOr(Schema.Number),
  lastRunAt: Schema.NullOr(Schema.Number),
  enabled: Schema.Boolean,
  deleteAfterRun: Schema.Boolean,
  failureCount: Schema.Number,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})
export type CronJob = Schema.Schema.Type<typeof CronJob>

export const CronRun = Schema.Struct({
  id: Schema.String,
  jobId: Schema.String,
  startedAt: Schema.Number,
  finishedAt: Schema.NullOr(Schema.Number),
  status: CronRunStatus,
  output: Schema.NullOr(Schema.String),
  error: Schema.NullOr(Schema.String),
})
export type CronRun = Schema.Schema.Type<typeof CronRun>

/** Minimum interval the scheduler aims to wake at. Floors one-shot responsiveness. */
export const CRON_TICK_INTERVAL_MS = 5_000

/** Bounded concurrency cap for parallel job dispatch. */
export const CRON_CONCURRENCY = 2

/** How long a lock is allowed to live before the sweep treats it as zombie. */
export const CRON_LOCK_EXPIRY_MS = 15 * 60 * 1000

/** Run-history retention before pruning. */
export const CRON_RUN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
