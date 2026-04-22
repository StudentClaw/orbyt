export const version = 1

export const up = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS canvas_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_url TEXT NOT NULL,
    credential_ref TEXT,
    user_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    professor TEXT,
    canvas_id TEXT,
    term TEXT,
    last_sync_at TEXT,
    color TEXT
  );

  CREATE TABLE IF NOT EXISTS coursework_items (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    effective_due_at TEXT,
    source_type TEXT NOT NULL CHECK(source_type IN ('assignment', 'module', 'page', 'announcement')),
    freshness_status TEXT NOT NULL DEFAULT 'unknown' CHECK(freshness_status IN ('fresh', 'stale', 'unknown')),
    points_possible REAL,
    submission_status TEXT,
    grade TEXT
  );

  CREATE TABLE IF NOT EXISTS canvas_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id TEXT REFERENCES courses(id),
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'success', 'error')),
    error_message TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    course_id TEXT REFERENCES courses(id),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS planned_sessions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'skipped', 'partial', 'unresolved', 'cancelled')),
    completion_note TEXT
  );

  CREATE TABLE IF NOT EXISTS activity_feed (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK(category IN ('canvas', 'planner', 'workflow', 'insight')),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    priority INTEGER,
    deep_link TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS onboarding_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    step INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'skipped')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    study_times TEXT,
    course_ranking TEXT,
    notification_prefs TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

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
