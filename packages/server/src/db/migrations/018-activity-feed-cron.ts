import type { RuntimeSqliteDatabase } from "../runtime-sqlite.js"

export const version = 18

/**
 * Expands the activity_feed.category check constraint to include 'cron' and
 * 'reminder', and adds three nullable columns used by the proactive engine:
 *   - notify    (1 = renderer fires a native Notification; 0 = silent)
 *   - acted_on  (NULL pending, 1 acted, 0 dismissed)
 *   - acted_at  (unix ms when the user dismissed/acted)
 *
 * SQLite can't modify CHECK constraints in place, so we rebuild the table.
 */
export function run(db: RuntimeSqliteDatabase): void {
  const tableExists = db
    .query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='activity_feed'",
    )
    .get()
  if (!tableExists) return

  const hasNotifyColumn = db
    .query<{ name: string }>("PRAGMA table_info(activity_feed)")
    .all()
    .some((row) => row.name === "notify")

  if (hasNotifyColumn) return

  db.run(`
    CREATE TABLE activity_feed_new (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL CHECK(category IN ('canvas', 'planner', 'workflow', 'insight', 'cron', 'reminder')),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      priority INTEGER,
      deep_link TEXT,
      notify INTEGER NOT NULL DEFAULT 0,
      acted_on INTEGER,
      acted_at INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  db.run(`
    INSERT INTO activity_feed_new
      (id, category, type, title, body, priority, deep_link, created_at)
    SELECT id, category, type, title, body, priority, deep_link, created_at
      FROM activity_feed
  `)
  db.run("DROP TABLE activity_feed")
  db.run("ALTER TABLE activity_feed_new RENAME TO activity_feed")
}
