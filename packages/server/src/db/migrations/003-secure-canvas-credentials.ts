export const version = 3

export const up = `
  ALTER TABLE canvas_accounts RENAME TO canvas_accounts_legacy;

  CREATE TABLE canvas_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_url TEXT NOT NULL,
    credential_ref TEXT,
    user_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT INTO canvas_accounts (id, instance_url, credential_ref, user_id, created_at)
  SELECT id, instance_url, NULL, user_id, created_at
  FROM canvas_accounts_legacy;

  DROP TABLE canvas_accounts_legacy;
`
