import { Context, Effect, Layer } from "effect"
import { createId } from "@orbyt/shared-runtime"
import {
  CRON_LOCK_EXPIRY_MS,
  CRON_RUN_RETENTION_MS,
  type CronJob,
  type CronPayloadKind,
  type CronRunStatus,
  type CronScheduleKind,
  type CronSessionTarget,
} from "@orbyt/contracts"
import { Database } from "../db/Database.js"

interface CronJobRow {
  id: string
  name: string
  schedule_kind: CronScheduleKind
  schedule_value: string
  schedule_tz: string | null
  session_target: CronSessionTarget | null
  payload_kind: CronPayloadKind
  payload_content: string
  next_run_at: number | null
  last_run_at: number | null
  enabled: number
  delete_after_run: number
  failure_count: number
  created_at: number
  updated_at: number
}

interface CountRow {
  cnt: number
}

function rowToJob(row: CronJobRow): CronJob {
  return {
    id: row.id,
    name: row.name,
    scheduleKind: row.schedule_kind,
    scheduleValue: row.schedule_value,
    scheduleTz: row.schedule_tz,
    sessionTarget: row.session_target,
    payloadKind: row.payload_kind,
    payloadContent: row.payload_content,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    enabled: row.enabled === 1,
    deleteAfterRun: row.delete_after_run === 1,
    failureCount: row.failure_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateJobInput {
  readonly name: string
  readonly scheduleKind: CronScheduleKind
  readonly scheduleValue: string
  readonly scheduleTz?: string | null
  readonly sessionTarget?: CronSessionTarget | null
  readonly payloadKind: CronPayloadKind
  readonly payloadContent: string
  readonly nextRunAt: number
  readonly deleteAfterRun?: boolean
}

export interface CompleteRunInput {
  readonly runId: string
  readonly jobId: string
  readonly finishedAt: number
  readonly status: CronRunStatus
  readonly output?: string | null
  readonly error?: string | null
  readonly nextRunAt: number | null
  readonly deleteJob?: boolean
}

export interface CronStoreShape {
  readonly claimDue: (now: number) => ReadonlyArray<{ job: CronJob; runId: string }>
  readonly completeRun: (input: CompleteRunInput) => void
  readonly createJob: (input: CreateJobInput) => CronJob
  readonly getJob: (id: string) => CronJob | null
  readonly listJobs: () => ReadonlyArray<CronJob>
  readonly hasJobs: () => boolean
  readonly maintenance: (now: number) => void
}

export class CronStore extends Context.Tag("CronStore")<
  CronStore,
  CronStoreShape
>() {}

export const CronStoreLive = Layer.effect(
  CronStore,
  Effect.gen(function* () {
    const db = yield* Database

    const insertRunRow = (jobId: string, startedAt: number): string => {
      const runId = createId("cronrun")
      db.execute(
        `INSERT INTO cron_runs (id, job_id, started_at, status)
         VALUES (?, ?, ?, 'running')`,
        [runId, jobId, startedAt],
      )
      return runId
    }

    const claimDue: CronStoreShape["claimDue"] = (now) =>
      db.transaction(() => {
        const due = db.query<CronJobRow>(
          `SELECT * FROM cron_jobs
           WHERE next_run_at IS NOT NULL
             AND next_run_at <= ?
             AND enabled = 1
             AND id NOT IN (SELECT job_id FROM cron_locks)
           ORDER BY next_run_at ASC
           LIMIT 16`,
          [now],
        )
        const claimed: { job: CronJob; runId: string }[] = []
        for (const row of due) {
          try {
            db.execute(
              `INSERT INTO cron_locks (job_id, acquired_at) VALUES (?, ?)`,
              [row.id, now],
            )
          } catch {
            // Another tick already locked this row — skip.
            continue
          }
          const runId = insertRunRow(row.id, now)
          claimed.push({ job: rowToJob(row), runId })
        }
        return claimed
      })

    const completeRun: CronStoreShape["completeRun"] = (input) =>
      db.transaction(() => {
        db.execute(
          `UPDATE cron_runs
              SET finished_at = ?, status = ?, output = ?, error = ?
            WHERE id = ?`,
          [
            input.finishedAt,
            input.status,
            input.output ?? null,
            input.error ?? null,
            input.runId,
          ],
        )

        if (input.deleteJob) {
          db.execute(`DELETE FROM cron_jobs WHERE id = ?`, [input.jobId])
        } else {
          const failureDelta = input.status === "failed" ? 1 : 0
          db.execute(
            `UPDATE cron_jobs
                SET next_run_at = ?,
                    last_run_at = ?,
                    failure_count = CASE WHEN ? = 'success' THEN 0
                                         ELSE failure_count + ? END,
                    updated_at = ?
              WHERE id = ?`,
            [
              input.nextRunAt,
              input.finishedAt,
              input.status,
              failureDelta,
              input.finishedAt,
              input.jobId,
            ],
          )
        }

        db.execute(`DELETE FROM cron_locks WHERE job_id = ?`, [input.jobId])
      })

    const createJob: CronStoreShape["createJob"] = (input) => {
      const id = createId("cronjob")
      const now = Date.now()
      db.execute(
        `INSERT INTO cron_jobs
           (id, name, schedule_kind, schedule_value, schedule_tz,
            session_target, payload_kind, payload_content,
            next_run_at, enabled, delete_after_run,
            failure_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, ?, ?)`,
        [
          id,
          input.name,
          input.scheduleKind,
          input.scheduleValue,
          input.scheduleTz ?? null,
          input.sessionTarget ?? null,
          input.payloadKind,
          input.payloadContent,
          input.nextRunAt,
          input.deleteAfterRun ? 1 : 0,
          now,
          now,
        ],
      )
      const row = db.get<CronJobRow>(`SELECT * FROM cron_jobs WHERE id = ?`, [id])
      if (!row) {
        throw new Error(`createJob: row not found after insert (id=${id})`)
      }
      return rowToJob(row)
    }

    const getJob: CronStoreShape["getJob"] = (id) => {
      const row = db.get<CronJobRow>(`SELECT * FROM cron_jobs WHERE id = ?`, [id])
      return row ? rowToJob(row) : null
    }

    const listJobs: CronStoreShape["listJobs"] = () => {
      const rows = db.query<CronJobRow>(
        `SELECT * FROM cron_jobs ORDER BY created_at ASC`,
      )
      return rows.map(rowToJob)
    }

    const hasJobs: CronStoreShape["hasJobs"] = () => {
      const row = db.get<CountRow>(`SELECT COUNT(*) as cnt FROM cron_jobs`)
      return (row?.cnt ?? 0) > 0
    }

    const maintenance: CronStoreShape["maintenance"] = (now) => {
      db.execute(
        `DELETE FROM cron_runs WHERE started_at < ?`,
        [now - CRON_RUN_RETENTION_MS],
      )
      db.execute(
        `DELETE FROM cron_locks WHERE acquired_at < ?`,
        [now - CRON_LOCK_EXPIRY_MS],
      )
    }

    return {
      claimDue,
      completeRun,
      createJob,
      getJob,
      listJobs,
      hasJobs,
      maintenance,
    }
  }),
)
