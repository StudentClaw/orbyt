export const version = 7

export const up = `
  ALTER TABLE provider_runtime_sessions ADD COLUMN cwd TEXT;
`
