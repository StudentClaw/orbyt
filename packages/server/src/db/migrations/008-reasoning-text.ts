export const version = 8

export const up = `
  ALTER TABLE orchestration_turns ADD COLUMN reasoning_text TEXT NOT NULL DEFAULT '';
`
