export const version = 2

export const up = `
  CREATE TABLE IF NOT EXISTS orchestration_events (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    thread_id TEXT,
    turn_id TEXT,
    command_id TEXT,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS command_receipts (
    command_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projection_state (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orchestration_threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    current_turn_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orchestration_turns (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES orchestration_threads(id),
    input_text TEXT NOT NULL,
    output_text TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS provider_runtime_sessions (
    thread_id TEXT PRIMARY KEY REFERENCES orchestration_threads(id),
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    last_error TEXT,
    updated_at TEXT NOT NULL
  );
`
