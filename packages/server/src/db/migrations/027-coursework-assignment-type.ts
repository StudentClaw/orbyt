import type { RuntimeSqliteDatabase } from "../runtime-sqlite.js"

export const version = 27

export function run(db: RuntimeSqliteDatabase): void {
  const tableExists = db
    .query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='coursework_items'",
    )
    .get()
  if (!tableExists) return

  const columns = db
    .query<{ name: string }>("PRAGMA table_info(coursework_items)")
    .all()
    .map((row) => row.name)

  if (!columns.includes("assignment_type")) {
    db.run("ALTER TABLE coursework_items ADD COLUMN assignment_type TEXT")
  }
}
