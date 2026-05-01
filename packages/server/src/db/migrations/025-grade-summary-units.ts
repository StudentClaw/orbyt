import type { RuntimeSqliteDatabase } from "../runtime-sqlite.js"

export const version = 25

export function run(db: RuntimeSqliteDatabase): void {
  const tableExists = db
    .query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='canvas_course_grade_summaries'",
    )
    .get()
  if (!tableExists) return

  const columns = db
    .query<{ name: string }>("PRAGMA table_info(canvas_course_grade_summaries)")
    .all()
    .map((row) => row.name)

  if (!columns.includes("units")) {
    db.run("ALTER TABLE canvas_course_grade_summaries ADD COLUMN units REAL")
  }
}
