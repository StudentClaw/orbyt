import type { RuntimeSqliteDatabase } from "../runtime-sqlite.js"

export const version = 25

export function run(db: RuntimeSqliteDatabase): void {
  const columns = db
    .query<{ name: string }>("PRAGMA table_info(canvas_course_grade_summaries)")
    .all()
    .map((row) => row.name)

  if (!columns.includes("units")) {
    db.run("ALTER TABLE canvas_course_grade_summaries ADD COLUMN units REAL")
  }
}
