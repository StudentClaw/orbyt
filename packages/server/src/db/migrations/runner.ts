import { Database } from "bun:sqlite"
import * as migration001 from "./001-initial.js"
import * as migration002 from "./002-orchestration-runtime.js"
import * as migration003 from "./003-secure-canvas-credentials.js"
import * as migration004 from "./004-onboarding-expansion.js"
import * as migration005 from "./005-chat-workspaces.js"
import * as migration006 from "./006-provider-runtime-state-repair.js"
import * as migration007 from "./007-provider-runtime-session-cwd.js"
import * as migration008 from "./008-reasoning-text.js"
import * as migration009 from "./009-thread-access-mode.js"
import * as migration010 from "./010-turn-attachments.js"

const migrations = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
]

export function runMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const currentVersion = db
    .query<{ version: number }, []>("SELECT MAX(version) as version FROM schema_version")
    .get()?.version ?? 0

  const isDuplicateColumn = (error: unknown): boolean =>
    error instanceof Error && error.message.includes("duplicate column name")

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      db.transaction(() => {
        const statements = migration.up.split(";").filter((s) => s.trim())
        for (const stmt of statements) {
          try {
            db.run(stmt)
          } catch (error) {
            if (!isDuplicateColumn(error)) throw error
          }
        }
        db.run("INSERT INTO schema_version (version) VALUES (?)", [migration.version])
      })()
    }
  }
}
