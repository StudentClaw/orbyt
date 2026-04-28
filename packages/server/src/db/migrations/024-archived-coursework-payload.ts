export const version = 24

export const up = `
  ALTER TABLE archived_coursework_items ADD COLUMN payload TEXT;
`
