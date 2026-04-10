import { Database } from "bun:sqlite"
import * as migration001 from "./001-initial.js"
import * as migration002 from "./002-orchestration-runtime.js"
import * as migration003 from "./003-provider-runtime-state.js"
import * as migration004 from "./004-provider-runtime-state-fix.js"

const migrations = [migration001, migration002, migration003, migration004]

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
