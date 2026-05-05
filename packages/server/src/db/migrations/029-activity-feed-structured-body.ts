import type { RuntimeSqliteDatabase } from "../runtime-sqlite.js"

export const version = 29

/**
 * Adds nullable structured_body column to activity_feed for storing structured
 * insight payloads (morning briefing JSON, future card shapes). Older entries
 * keep NULL and continue to render via the plain title/body fallback.
 */
export function run(db: RuntimeSqliteDatabase): void {
  const tableExists = db
    .query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='activity_feed'",
    )
    .get()
  if (!tableExists) return

  const columns = db
    .query<{ name: string }>("PRAGMA table_info(activity_feed)")
    .all()
    .map((row) => row.name)

  if (!columns.includes("structured_body")) {
    db.run("ALTER TABLE activity_feed ADD COLUMN structured_body TEXT")
  }
}
