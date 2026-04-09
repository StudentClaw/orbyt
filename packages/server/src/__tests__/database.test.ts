import { describe, test, expect } from "bun:test"
import { Database as BunDatabase } from "bun:sqlite"
import { runMigrations } from "../db/migrations/runner.js"

describe("Database migrations", () => {
  test("creates SQLite DB in memory", () => {
    const db = new BunDatabase(":memory:")
    expect(db).toBeDefined()
    db.close()
  })

  test("migrations create all expected tables", () => {
    const db = new BunDatabase(":memory:")
    runMigrations(db)

    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all()
      .map((t) => t.name)

    expect(tables).toContain("schema_version")
    expect(tables).toContain("canvas_accounts")
    expect(tables).toContain("courses")
    expect(tables).toContain("coursework_items")
    expect(tables).toContain("canvas_sync_log")
    expect(tables).toContain("tasks")
    expect(tables).toContain("planned_sessions")
    expect(tables).toContain("activity_feed")
    expect(tables).toContain("settings")
    expect(tables).toContain("onboarding_state")
    expect(tables).toContain("user_preferences")
    expect(tables).toContain("orchestration_events")
    expect(tables).toContain("command_receipts")
    expect(tables).toContain("projection_state")
    expect(tables).toContain("orchestration_threads")
    expect(tables).toContain("orchestration_turns")
    expect(tables).toContain("provider_runtime_sessions")

    db.close()
  })

  test("migrations are idempotent", () => {
    const db = new BunDatabase(":memory:")
    runMigrations(db)
    runMigrations(db) // run again

    const version = db
      .query<{ version: number }, []>("SELECT MAX(version) as version FROM schema_version")
      .get()
    expect(version?.version).toBe(2)

    db.close()
  })

  test("schema_version tracks applied versions", () => {
    const db = new BunDatabase(":memory:")
    runMigrations(db)

    const rows = db
      .query<{ version: number; applied_at: string }, []>("SELECT * FROM schema_version")
      .all()
    expect(rows.length).toBe(2)
    expect(rows.map((row) => row.version)).toEqual([1, 2])
    expect(rows.every((row) => Boolean(row.applied_at))).toBe(true)

    db.close()
  })

  test("existing version 1 databases are upgraded to include orchestration tables", () => {
    const db = new BunDatabase(":memory:")
    db.run(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)
    db.run(`
      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL
      );
    `)
    db.run("INSERT INTO schema_version (version) VALUES (1)")

    runMigrations(db)

    const version = db
      .query<{ version: number }, []>("SELECT MAX(version) as version FROM schema_version")
      .get()
    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all()
      .map((t) => t.name)

    expect(version?.version).toBe(2)
    expect(tables).toContain("orchestration_threads")
    expect(tables).toContain("provider_runtime_sessions")

    db.close()
  })
})
