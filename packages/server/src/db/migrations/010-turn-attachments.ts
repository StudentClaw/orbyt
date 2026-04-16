export const version = 10

export const up = `
  CREATE TABLE IF NOT EXISTS orchestration_turn_attachments (
    id TEXT PRIMARY KEY,
    turn_id TEXT NOT NULL REFERENCES orchestration_turns(id),
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    kind TEXT NOT NULL,
    position INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS orchestration_turn_attachments_turn_id_idx
    ON orchestration_turn_attachments(turn_id);
`
