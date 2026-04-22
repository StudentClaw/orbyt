import type { RuntimeSqliteDatabase } from "../runtime-sqlite.js"
import { pickRandomCourseColor } from "../../canvas/courseColors.js"

export const version = 14

export function run(db: RuntimeSqliteDatabase): void {
  const coursesTableExists = db
    .query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='courses'",
    )
    .get()

  if (!coursesTableExists) return

  const columns = db
    .query<{ name: string }>("PRAGMA table_info(courses)")
    .all()
    .map((row) => row.name)

  if (!columns.includes("color")) {
    db.run("ALTER TABLE courses ADD COLUMN color TEXT")
  }

  const rows = db
    .query<{ id: string }>("SELECT id FROM courses WHERE color IS NULL OR TRIM(color) = ''")
    .all()

  for (const row of rows) {
    db.run("UPDATE courses SET color = ? WHERE id = ?", [pickRandomCourseColor(), row.id])
  }
}
