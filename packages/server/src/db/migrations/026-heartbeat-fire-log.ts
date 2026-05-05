export const version = 26

export const up = `
  CREATE TABLE IF NOT EXISTS heartbeat_fire_log (
    item_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('starting_soon', 'due_soon', 'overdue')),
    fired_at INTEGER NOT NULL,
    PRIMARY KEY (item_id, state, fired_at)
  );

  CREATE INDEX IF NOT EXISTS idx_heartbeat_fire_log_item_state
    ON heartbeat_fire_log(item_id, state, fired_at DESC);
`
