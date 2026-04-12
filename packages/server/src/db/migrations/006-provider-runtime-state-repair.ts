export const version = 6

export const up = `
  CREATE TABLE IF NOT EXISTS provider_runtime_state (
    provider TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    auth_state TEXT NOT NULL,
    last_error_code TEXT,
    last_error_message TEXT,
    queued_turn_count INTEGER NOT NULL DEFAULT 0,
    runtime_payload TEXT,
    last_updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS queued_provider_turns (
    turn_id TEXT PRIMARY KEY REFERENCES orchestration_turns(id),
    thread_id TEXT NOT NULL REFERENCES orchestration_threads(id),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  ALTER TABLE provider_runtime_sessions ADD COLUMN provider_thread_id TEXT;
  ALTER TABLE provider_runtime_sessions ADD COLUMN auth_state TEXT NOT NULL DEFAULT 'unknown';
  ALTER TABLE provider_runtime_sessions ADD COLUMN runtime_payload TEXT;
`
