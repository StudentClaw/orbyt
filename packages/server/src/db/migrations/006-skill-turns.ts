export const version = 6

export const up = `
  ALTER TABLE orchestration_turns ADD COLUMN skill_id TEXT;
  ALTER TABLE orchestration_turns ADD COLUMN skill_name TEXT;
`
