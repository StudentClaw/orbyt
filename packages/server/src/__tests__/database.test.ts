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

    db.close()
  })

  test("migrations are idempotent", () => {
    const db = new BunDatabase(":memory:")
    runMigrations(db)
    runMigrations(db) // run again

    const version = db
      .query<{ version: number }, []>("SELECT MAX(version) as version FROM schema_version")
      .get()
    expect(version?.version).toBe(1)

    db.close()
  })

  test("schema_version tracks applied versions", () => {
    const db = new BunDatabase(":memory:")
    runMigrations(db)

    const rows = db
      .query<{ version: number; applied_at: string }, []>("SELECT * FROM schema_version")
      .all()
    expect(rows.length).toBe(1)
    expect(rows[0]!.version).toBe(1)
    expect(rows[0]!.applied_at).toBeDefined()

    db.close()
  })
})
