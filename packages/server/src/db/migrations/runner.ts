import { Database } from "bun:sqlite"
import * as migration001 from "./001-initial.js"

const migrations = [migration001]

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
