import type { Database } from "bun:sqlite"

export const version = 12

export function run(db: Database): void {
  const tableExists = db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='coursework_items'",
    )
    .get()
  if (!tableExists) return

  const columns = db
    .query<{ name: string }, []>("PRAGMA table_info(coursework_items)")
    .all()
    .map((row) => row.name)

  if (!columns.includes("canvas_assignment_id")) {
    db.run("ALTER TABLE coursework_items ADD COLUMN canvas_assignment_id TEXT")
  }
  if (!columns.includes("points_earned")) {
    db.run("ALTER TABLE coursework_items ADD COLUMN points_earned REAL")
  }
  if (!columns.includes("html_url")) {
    db.run("ALTER TABLE coursework_items ADD COLUMN html_url TEXT")
  }

  db.run(
    `CREATE INDEX IF NOT EXISTS idx_coursework_canvas_assignment
       ON coursework_items(course_id, canvas_assignment_id)`,
  )
}
