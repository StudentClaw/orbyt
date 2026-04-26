export const version = 19

export const up = `
  CREATE TABLE IF NOT EXISTS orchestration_turn_references (
    id TEXT PRIMARY KEY,
    turn_id TEXT NOT NULL REFERENCES orchestration_turns(id),
    kind TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    label TEXT NOT NULL,
    url TEXT,
    position INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS orchestration_turn_references_turn_id_idx
    ON orchestration_turn_references(turn_id);
`
