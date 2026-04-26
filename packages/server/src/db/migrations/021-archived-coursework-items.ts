export const version = 21

export const up = `
  CREATE TABLE IF NOT EXISTS archived_coursework_items (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id),
    source_type TEXT NOT NULL CHECK(source_type IN ('assignment', 'module', 'page', 'announcement')),
    source_id TEXT NOT NULL,
    title TEXT,
    html_url TEXT,
    archived_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_archived_coursework_source
    ON archived_coursework_items(course_id, source_type, source_id);
`
