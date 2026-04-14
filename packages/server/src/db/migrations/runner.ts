import { Database } from "bun:sqlite"
import * as migration001 from "./001-initial.js"
import * as migration002 from "./002-orchestration-runtime.js"
import * as migration003 from "./003-secure-canvas-credentials.js"
import * as migration004 from "./004-onboarding-expansion.js"
import * as migration005 from "./005-chat-workspaces.js"
import * as migration006 from "./006-skill-turns.js"

const migrations = [migration001, migration002, migration003, migration004, migration005, migration006]

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

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      db.transaction(() => {
        const statements = migration.up.split(";").filter((s) => s.trim())
        for (const stmt of statements) {
          db.run(stmt)
        }
        db.run("INSERT INTO schema_version (version) VALUES (?)", [migration.version])
      })()
    }
  }
}
