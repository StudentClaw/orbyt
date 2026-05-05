import type { RuntimeSqliteDatabase } from "../runtime-sqlite.js"
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
import * as migration011 from "./011-onboarding-schema-repair.js"
import * as migration012 from "./012-coursework-canvas-fields.js"
import * as migration013 from "./013-canvas-student-runtime.js"
import * as migration014 from "./014-course-colors.js"
import * as migration015 from "./015-memory-graph-path-preference.js"
import * as migration016 from "./016-default-access-mode-preference.js"
import * as migration017 from "./017-cron-engine.js"
import * as migration018 from "./018-activity-feed-cron.js"
import * as migration019 from "./019-dna-onboarding.js"
import * as migration020 from "./020-turn-references.js"
import * as migration021 from "./021-course-assignment-sources.js"
import * as migration022 from "./022-archived-coursework-items.js"
import * as migration023 from "./023-dna-onboarding-repair.js"
import * as migration024 from "./024-archived-coursework-payload.js"
import * as migration025 from "./025-grade-summary-units.js"
import * as migration026 from "./026-heartbeat-fire-log.js"
import * as migration027 from "./027-coursework-assignment-type.js"
import * as migration028 from "./028-dashboard-tour-completion.js"
import * as migration029 from "./029-activity-feed-structured-body.js"
import * as migration030 from "./030-cron-internal-task.js"

type SqlMigration = {
  readonly version: number
  readonly up: string
}

type ProgrammaticMigration = {
  readonly version: number
  readonly run: (db: RuntimeSqliteDatabase) => void
}

const migrations: ReadonlyArray<SqlMigration | ProgrammaticMigration> = [
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
  migration011,
  migration012,
  migration013,
  migration014,
  migration015,
  migration016,
  migration017,
  migration018,
  migration019,
  migration020,
  migration021,
  migration022,
  migration023,
  migration024,
  migration025,
  migration026,
  migration027,
  migration028,
  migration029,
  migration030,
]

export function runMigrations(db: RuntimeSqliteDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const currentVersion = db
    .query<{ version: number }>("SELECT MAX(version) as version FROM schema_version")
    .get()?.version ?? 0

  const isDuplicateColumn = (error: unknown): boolean =>
    error instanceof Error && error.message.includes("duplicate column name")

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      db.transaction(() => {
        if ("up" in migration) {
          const statements = migration.up.split(";").filter((statement: string) => statement.trim())
          for (const stmt of statements) {
            try {
              db.run(stmt)
            } catch (error) {
              if (!isDuplicateColumn(error)) throw error
            }
          }
        } else {
          migration.run(db)
        }
        db.run("INSERT INTO schema_version (version) VALUES (?)", [migration.version])
      })()
    }
  }
}
