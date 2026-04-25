export const version = 17

export const up = `
  CREATE TABLE IF NOT EXISTS cron_jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    schedule_kind TEXT NOT NULL CHECK(schedule_kind IN ('at', 'every', 'cron')),
    schedule_value TEXT NOT NULL,
    schedule_tz TEXT,
    session_target TEXT CHECK(session_target IN ('main', 'isolated')),
    payload_kind TEXT NOT NULL CHECK(payload_kind IN ('agentTurn', 'reminder')),
    payload_content TEXT NOT NULL,
    next_run_at INTEGER,
    last_run_at INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    delete_after_run INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_cron_jobs_due ON cron_jobs (next_run_at, enabled);

  CREATE TABLE IF NOT EXISTS cron_runs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    status TEXT NOT NULL CHECK(status IN ('running', 'success', 'failed')),
    output TEXT,
    error TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs (job_id, started_at DESC);

  CREATE TABLE IF NOT EXISTS cron_locks (
    job_id TEXT PRIMARY KEY REFERENCES cron_jobs(id) ON DELETE CASCADE,
    acquired_at INTEGER NOT NULL
  );
`
