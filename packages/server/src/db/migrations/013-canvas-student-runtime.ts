import type { Database } from "bun:sqlite"

export const version = 13

export function run(db: Database): void {
  const courseworkTableExists = db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='coursework_items'",
    )
    .get()
  const courseworkColumns = courseworkTableExists
    ? db
        .query<{ name: string }, []>("PRAGMA table_info(coursework_items)")
        .all()
        .map((row) => row.name)
    : []

  if (courseworkTableExists && !courseworkColumns.includes("is_upcoming")) {
    db.run("ALTER TABLE coursework_items ADD COLUMN is_upcoming INTEGER NOT NULL DEFAULT 0")
  }

  if (courseworkTableExists && !courseworkColumns.includes("status_bucket")) {
    db.run(
      "ALTER TABLE coursework_items ADD COLUMN status_bucket TEXT CHECK(status_bucket IN ('submitted', 'pending', 'overdue'))",
    )
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS canvas_course_grade_summaries (
      course_id TEXT PRIMARY KEY REFERENCES courses(id),
      current_score REAL,
      current_grade TEXT,
      final_score REAL,
      final_grade TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS canvas_todo_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id TEXT REFERENCES courses(id),
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      due_at TEXT,
      html_url TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS canvas_peer_review_todo (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id),
      assignment_id TEXT NOT NULL,
      assignment_name TEXT NOT NULL,
      reviewee_user_id TEXT,
      assessor_user_id TEXT,
      workflow_state TEXT
    )
  `)

  if (courseworkTableExists) {
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_coursework_status_bucket
         ON coursework_items(course_id, status_bucket, effective_due_at)`,
    )
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_coursework_is_upcoming
         ON coursework_items(is_upcoming, effective_due_at)`,
    )
  }
}
