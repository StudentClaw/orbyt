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
    expect(tables).toContain("provider_runtime_state")
    expect(tables).toContain("queued_provider_turns")
    expect(tables).toContain("chat_workspaces")

    db.close()
  })

  test("migrations are idempotent", () => {
    const db = new BunDatabase(":memory:")
    runMigrations(db)
    runMigrations(db) // run again

    const version = db
      .query<{ version: number }, []>("SELECT MAX(version) as version FROM schema_version")
      .get()
    expect(version?.version).toBe(7)

    db.close()
  })

  test("schema_version tracks applied versions", () => {
    const db = new BunDatabase(":memory:")
    runMigrations(db)

    const rows = db
      .query<{ version: number; applied_at: string }, []>("SELECT * FROM schema_version")
      .all()
    expect(rows.length).toBe(7)
    expect(rows.map((row) => row.version)).toEqual([1, 2, 3, 4, 5, 6, 7])
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
    db.run(`
      CREATE TABLE IF NOT EXISTS canvas_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instance_url TEXT NOT NULL,
        api_token TEXT NOT NULL,
        user_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

    expect(version?.version).toBe(7)
    expect(tables).toContain("orchestration_threads")
    expect(tables).toContain("provider_runtime_sessions")
    expect(tables).toContain("provider_runtime_state")
    expect(tables).toContain("queued_provider_turns")
    expect(tables).toContain("chat_workspaces")
    expect(tables).toContain("canvas_accounts")

    const columns = db
      .query<{ name: string }, []>("PRAGMA table_info(canvas_accounts)")
      .all()
      .map((column) => column.name)

    expect(columns).toContain("credential_ref")
    expect(columns).not.toContain("api_token")

    db.close()
  })

  test("migrations replace plaintext canvas tokens with credential references", () => {
    const db = new BunDatabase(":memory:")
    runMigrations(db)

    const columns = db
      .query<{ name: string }, []>("PRAGMA table_info(canvas_accounts)")
      .all()
      .map((column) => column.name)

    expect(columns).toContain("credential_ref")
    expect(columns).not.toContain("api_token")

    db.close()
  })

  test("migration adds workspace ownership and imports legacy chats", () => {
    const db = new BunDatabase(":memory:")
    runMigrations(db)

    const legacyWorkspace = db
      .query<{
        id: string
        kind: string
        name: string
        root_path: string | null
      }, []>(
        "SELECT id, kind, name, root_path FROM chat_workspaces WHERE id = 'workspace_legacy'",
      )
      .get()
    const threadColumns = db
      .query<{ name: string }, []>("PRAGMA table_info(orchestration_threads)")
      .all()
      .map((column) => column.name)

    expect(legacyWorkspace).toEqual({
      id: "workspace_legacy",
      kind: "legacy",
      name: "Legacy chats",
      root_path: null,
    })
    expect(threadColumns).toContain("workspace_id")

    db.close()
  })

  test("migration preserves canvas account metadata while clearing plaintext credentials", () => {
    const db = new BunDatabase(":memory:")
    db.run(`
      CREATE TABLE schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.run(`
      CREATE TABLE canvas_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instance_url TEXT NOT NULL,
        api_token TEXT NOT NULL,
        user_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    // Migration 5 alters orchestration_threads, so we need the table from migration 2
    db.run(`
      CREATE TABLE IF NOT EXISTS orchestration_threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        current_turn_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    db.run(
      "INSERT INTO canvas_accounts (id, instance_url, api_token, user_id, created_at) VALUES (?, ?, ?, ?, ?)",
      [7, "https://canvas.example", "secret-token", "user-42", "2026-04-10T00:00:00.000Z"],
    )
    db.run("INSERT INTO schema_version (version) VALUES (2)")

    runMigrations(db)

    const row = db
      .query<{
        id: number
        instance_url: string
        credential_ref: string | null
        user_id: string | null
        created_at: string
      }, []>(
        "SELECT id, instance_url, credential_ref, user_id, created_at FROM canvas_accounts",
      )
      .get()

    expect(row).toEqual({
      id: 7,
      instance_url: "https://canvas.example",
      credential_ref: null,
      user_id: "user-42",
      created_at: "2026-04-10T00:00:00.000Z",
    })

    db.close()
  })

  test("repair migration backfills provider runtime tables for existing version 5 databases", () => {
    const db = new BunDatabase(":memory:")
    db.run(`
      CREATE TABLE schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.run(`
      CREATE TABLE orchestration_threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        current_turn_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        workspace_id TEXT
      )
    `)
    db.run(`
      CREATE TABLE provider_runtime_sessions (
        thread_id TEXT PRIMARY KEY REFERENCES orchestration_threads(id),
        provider TEXT NOT NULL,
        status TEXT NOT NULL,
        last_error TEXT,
        updated_at TEXT NOT NULL
      )
    `)
    db.run("INSERT INTO schema_version (version) VALUES (5)")

    runMigrations(db)

    const tables = db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((table) => table.name)
    const sessionColumns = db
      .query<{ name: string }, []>("PRAGMA table_info(provider_runtime_sessions)")
      .all()
      .map((column) => column.name)
    const version = db
      .query<{ version: number }, []>("SELECT MAX(version) as version FROM schema_version")
      .get()

    expect(version?.version).toBe(7)
    expect(tables).toContain("provider_runtime_state")
    expect(tables).toContain("queued_provider_turns")
    expect(sessionColumns).toContain("provider_thread_id")
    expect(sessionColumns).toContain("auth_state")
    expect(sessionColumns).toContain("runtime_payload")
    expect(sessionColumns).toContain("cwd")

    db.close()
  })
})
