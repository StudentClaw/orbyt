export const version = 9

export const up = `
  ALTER TABLE orchestration_threads ADD COLUMN access_mode TEXT NOT NULL DEFAULT 'default';
`
