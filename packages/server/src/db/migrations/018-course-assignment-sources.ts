import type { RuntimeSqliteDatabase } from "../runtime-sqlite.js"

export const version = 18

function tableExists(db: RuntimeSqliteDatabase, tableName: string): boolean {
  return Boolean(
    db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    ).get(tableName),
  )
}

function columnNames(db: RuntimeSqliteDatabase, tableName: string): string[] {
  return db
    .query<{ name: string }>(`PRAGMA table_info(${tableName})`)
    .all()
    .map((row) => row.name)
}

function addColumnIfMissing(
  db: RuntimeSqliteDatabase,
  tableName: string,
  columns: readonly string[],
  columnName: string,
  ddl: string,
): void {
  if (!columns.includes(columnName)) {
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${ddl}`)
  }
}

export function run(db: RuntimeSqliteDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS course_assignment_sources (
      id TEXT PRIMARY KEY,
      local_course_id TEXT REFERENCES courses(id),
      canvas_course_id TEXT,
      source_kind TEXT NOT NULL CHECK(source_kind IN ('canvas_page')),
      url TEXT NOT NULL,
      parser TEXT NOT NULL CHECK(parser IN ('dated_reading_schedule')),
      purpose TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      graph_node_path TEXT,
      graph_rule_index INTEGER NOT NULL DEFAULT 0,
      last_checked_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_course_assignment_sources_enabled
      ON course_assignment_sources(enabled, local_course_id)
  `)

  if (!tableExists(db, "coursework_items")) return

  const columns = columnNames(db, "coursework_items")
  addColumnIfMissing(db, "coursework_items", columns, "description", "description TEXT")
  addColumnIfMissing(
    db,
    "coursework_items",
    columns,
    "source_due_date_kind",
    "source_due_date_kind TEXT CHECK(source_due_date_kind IN ('assignment_due_at', 'assignment_override_due_at', 'module_deadline', 'page_deadline', 'announcement_deadline', 'inferred'))",
  )
  addColumnIfMissing(db, "coursework_items", columns, "cached_at", "cached_at TEXT")
  addColumnIfMissing(db, "coursework_items", columns, "last_verified_at", "last_verified_at TEXT")
  addColumnIfMissing(db, "coursework_items", columns, "source_updated_at", "source_updated_at TEXT")
  addColumnIfMissing(
    db,
    "coursework_items",
    columns,
    "assignment_source_id",
    "assignment_source_id TEXT REFERENCES course_assignment_sources(id)",
  )

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_coursework_assignment_source
      ON coursework_items(assignment_source_id, source_type, freshness_status)
  `)
}
