import type { RuntimeSqliteDatabase } from "../runtime-sqlite.js"

export const version = 16

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

  if (!columns.includes("default_access_mode")) {
    db.run(
      "ALTER TABLE user_preferences ADD COLUMN default_access_mode TEXT NOT NULL DEFAULT 'default'",
    )
  }
}
