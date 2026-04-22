import type { RuntimeSqliteDatabase } from "../runtime-sqlite.js"

export const version = 15

export function run(db: RuntimeSqliteDatabase): void {
  const preferencesTableExists = db
    .query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user_preferences'",
    )
    .get()

  if (!preferencesTableExists) return

  const columns = db
    .query<{ name: string }>("PRAGMA table_info(user_preferences)")
    .all()
    .map((row) => row.name)

  if (!columns.includes("memory_graph_path")) {
    db.run("ALTER TABLE user_preferences ADD COLUMN memory_graph_path TEXT")
  }
}
