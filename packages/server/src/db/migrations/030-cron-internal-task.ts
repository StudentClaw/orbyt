import type { RuntimeSqliteDatabase } from "../runtime-sqlite.js"

export const version = 30

// Migration 017 created cron_jobs with CHECK(payload_kind IN ('agentTurn', 'reminder')).
// The contract was later widened to also accept 'internalTask' (used by the canvas-sync
// cron job), but the table CHECK was never updated — so seedDefaultJobs has been
// failing on every fresh DB, leaving Canvas without a recurring sync job.
//
// SQLite cannot ALTER a CHECK constraint in place, so we rebuild the table. The
// implicit DELETE that DROP TABLE performs cascades to cron_runs (run history);
// that loss is acceptable — runs repopulate naturally on the next tick.
export function run(db: RuntimeSqliteDatabase): void {
  db.run(`
    CREATE TABLE cron_jobs_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      schedule_kind TEXT NOT NULL CHECK(schedule_kind IN ('at', 'every', 'cron')),
      schedule_value TEXT NOT NULL,
      schedule_tz TEXT,
      session_target TEXT CHECK(session_target IN ('main', 'isolated')),
      payload_kind TEXT NOT NULL CHECK(payload_kind IN ('agentTurn', 'reminder', 'internalTask')),
      payload_content TEXT NOT NULL,
      next_run_at INTEGER,
      last_run_at INTEGER,
      enabled INTEGER NOT NULL DEFAULT 1,
      delete_after_run INTEGER NOT NULL DEFAULT 0,
      failure_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  db.run(`
    INSERT INTO cron_jobs_new (
      id, name, schedule_kind, schedule_value, schedule_tz, session_target,
      payload_kind, payload_content, next_run_at, last_run_at, enabled,
      delete_after_run, failure_count, created_at, updated_at
    )
    SELECT id, name, schedule_kind, schedule_value, schedule_tz, session_target,
           payload_kind, payload_content, next_run_at, last_run_at, enabled,
           delete_after_run, failure_count, created_at, updated_at
    FROM cron_jobs
  `)

  db.run("DROP TABLE cron_jobs")
  db.run("ALTER TABLE cron_jobs_new RENAME TO cron_jobs")
  db.run("CREATE INDEX IF NOT EXISTS idx_cron_jobs_due ON cron_jobs (next_run_at, enabled)")
}
