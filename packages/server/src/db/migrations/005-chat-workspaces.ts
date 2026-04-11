export const version = 5

export const up = `
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

  CREATE TABLE IF NOT EXISTS chat_workspaces (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    root_path TEXT,
    availability TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS chat_workspaces_filesystem_root_path_unique
    ON chat_workspaces(root_path)
    WHERE kind = 'filesystem';

  INSERT OR IGNORE INTO chat_workspaces (id, kind, name, root_path, availability, created_at, updated_at)
  VALUES (
    'workspace_legacy',
    'legacy',
    'Legacy chats',
    NULL,
    NULL,
    datetime('now'),
    datetime('now')
  );

  ALTER TABLE orchestration_threads
    ADD COLUMN workspace_id TEXT REFERENCES chat_workspaces(id);

  UPDATE orchestration_threads
  SET workspace_id = 'workspace_legacy'
  WHERE workspace_id IS NULL;

  CREATE INDEX IF NOT EXISTS orchestration_threads_workspace_id_idx
    ON orchestration_threads(workspace_id);
`
