import { describe, test, expect } from "bun:test"
import { createBunTestDatabase, runBunMigrations } from "./db-test-helpers.js"

describe("Database migrations", () => {
  test("creates SQLite DB in memory", () => {
    const db = createBunTestDatabase(":memory:")
    expect(db).toBeDefined()
    db.close()
  })

  test("migrations create all expected tables", () => {
    const db = createBunTestDatabase(":memory:")
    runBunMigrations(db)

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
    expect(tables).toContain("canvas_course_grade_summaries")
    expect(tables).toContain("canvas_todo_items")
    expect(tables).toContain("canvas_peer_review_todo")
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
    expect(tables).toContain("orchestration_turn_attachments")
    expect(tables).toContain("orchestration_turn_references")

    db.close()
  })

  test("migrations are idempotent", () => {
    const db = createBunTestDatabase(":memory:")
    runBunMigrations(db)
    runBunMigrations(db) // run again

    const version = db
      .query<{ version: number }, []>("SELECT MAX(version) as version FROM schema_version")
      .get()
    expect(version?.version).toBe(17)

    db.close()
  })

  test("schema_version tracks applied versions", () => {
    const db = createBunTestDatabase(":memory:")
    runBunMigrations(db)

    const rows = db
      .query<{ version: number; applied_at: string }, []>("SELECT * FROM schema_version")
      .all()
    expect(rows.length).toBe(17)
    expect(rows.map((row) => row.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])
    expect(rows.every((row) => Boolean(row.applied_at))).toBe(true)

    db.close()
  })

  test("migration 017 creates orchestration_turn_references with expected columns", () => {
    const db = createBunTestDatabase(":memory:")
    runBunMigrations(db)

    const columns = db
      .query<{ name: string }, []>(
        "PRAGMA table_info(orchestration_turn_references)",
      )
      .all()
      .map((column) => column.name)

    expect(columns).toEqual([
      "id",
      "turn_id",
      "kind",
      "reference_id",
      "label",
      "url",
      "position",
    ])

    const indexes = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'orchestration_turn_references'",
      )
      .all()
      .map((row) => row.name)

    expect(indexes).toContain("orchestration_turn_references_turn_id_idx")

    db.close()
  })

  test("existing version 1 databases are upgraded to include orchestration tables", () => {
    const db = createBunTestDatabase(":memory:")
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

    runBunMigrations(db)

    const version = db
      .query<{ version: number }, []>("SELECT MAX(version) as version FROM schema_version")
      .get()
    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all()
      .map((t) => t.name)

    expect(version?.version).toBe(17)
    expect(tables).toContain("orchestration_threads")
    expect(tables).toContain("provider_runtime_sessions")
    expect(tables).toContain("provider_runtime_state")
    expect(tables).toContain("queued_provider_turns")
    expect(tables).toContain("chat_workspaces")
    expect(tables).toContain("orchestration_turn_attachments")
    expect(tables).toContain("canvas_accounts")

    const columns = db
      .query<{ name: string }, []>("PRAGMA table_info(courses)")
      .all()
      .map((column) => column.name)

    expect(columns).toContain("color")

    const accountColumns = db
      .query<{ name: string }, []>("PRAGMA table_info(canvas_accounts)")
      .all()
      .map((column) => column.name)

    expect(accountColumns).toContain("credential_ref")
    expect(accountColumns).not.toContain("api_token")

    db.close()
  })

  test("migrations replace plaintext canvas tokens with credential references", () => {
    const db = createBunTestDatabase(":memory:")
    runBunMigrations(db)

    const columns = db
      .query<{ name: string }, []>("PRAGMA table_info(canvas_accounts)")
      .all()
      .map((column) => column.name)

    expect(columns).toContain("credential_ref")
    expect(columns).not.toContain("api_token")

    db.close()
  })

  test("migration backfills a color for existing courses", () => {
    const db = createBunTestDatabase(":memory:")
    db.run(`
      CREATE TABLE schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.run(`
      CREATE TABLE courses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        professor TEXT,
        canvas_id TEXT,
        term TEXT,
        last_sync_at TEXT
      )
    `)
    db.run("INSERT INTO courses (id, name, code) VALUES ('course-1', 'Intro to CS', 'CS101')")
    db.run("INSERT INTO schema_version (version) VALUES (13)")

    runBunMigrations(db)

    const row = db
      .query<{ color: string | null }, []>("SELECT color FROM courses WHERE id = 'course-1'")
      .get()

    expect(row?.color).toBeTruthy()
    db.close()
  })

  test("migration adds workspace ownership and imports legacy chats", () => {
    const db = createBunTestDatabase(":memory:")
    runBunMigrations(db)

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
    expect(threadColumns).toContain("access_mode")

    db.close()
  })

  test("migration preserves canvas account metadata while clearing plaintext credentials", () => {
    const db = createBunTestDatabase(":memory:")
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

    runBunMigrations(db)

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
    const db = createBunTestDatabase(":memory:")
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
      CREATE TABLE orchestration_turns (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES orchestration_threads(id),
        input_text TEXT NOT NULL,
        output_text TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        updated_at TEXT NOT NULL
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

    runBunMigrations(db)

    const tables = db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((table: { name: string }) => table.name)
    const sessionColumns = db
      .query<{ name: string }, []>("PRAGMA table_info(provider_runtime_sessions)")
      .all()
      .map((column: { name: string }) => column.name)
    const version = db
      .query<{ version: number }, []>("SELECT MAX(version) as version FROM schema_version")
      .get()

    expect(version?.version).toBe(17)
    expect(tables).toContain("provider_runtime_state")
    expect(tables).toContain("queued_provider_turns")
    expect(sessionColumns).toContain("provider_thread_id")
    expect(sessionColumns).toContain("auth_state")
    expect(sessionColumns).toContain("runtime_payload")
    expect(sessionColumns).toContain("cwd")
    expect(tables).toContain("orchestration_turn_attachments")

    const threadColumns = db
      .query<{ name: string }, []>("PRAGMA table_info(orchestration_threads)")
      .all()
      .map((column: { name: string }) => column.name)

    expect(threadColumns).toContain("access_mode")

    db.close()
  })

  test("repair migration upgrades legacy onboarding tables for fully versioned databases", () => {
    const db = createBunTestDatabase(":memory:")
    db.run(`
      CREATE TABLE schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.run(`
      CREATE TABLE onboarding_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        step INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'skipped')),
        completed_at TEXT
      )
    `)
    db.run(`
      CREATE TABLE user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        study_times TEXT,
        course_ranking TEXT,
        notification_prefs TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.run(`
      CREATE TABLE ai_auth_state (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        status TEXT NOT NULL DEFAULT 'pending',
        provider TEXT,
        connected_at TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        api_key TEXT
      )
    `)
    db.run(`
      INSERT INTO user_preferences (study_times, course_ranking, notification_prefs, updated_at)
      VALUES (
        '["morning"]',
        '["course-a"]',
        '{"notificationEnabled":false,"quietHoursStart":"23:00","quietHoursEnd":"07:00"}',
        '2026-04-16T00:00:00.000Z'
      )
    `)
    db.run(`
      INSERT INTO onboarding_state (step, status, completed_at)
      VALUES (2, 'completed', '2026-04-16T00:00:00.000Z')
    `)
    for (let version = 1; version <= 10; version += 1) {
      db.run("INSERT INTO schema_version (version) VALUES (?)", [version])
    }

    runBunMigrations(db)

    const userPreferenceColumns = db
      .query<{ name: string }, []>("PRAGMA table_info(user_preferences)")
      .all()
      .map((column) => column.name)
    const onboardingColumns = db
      .query<{ name: string }, []>("PRAGMA table_info(onboarding_state)")
      .all()
      .map((column) => column.name)
    const userPreferenceRow = db
      .query<{
        id: number
        study_times: string
        course_ranking: string
        max_session_mins: number
        off_limit_days: string
        notification_enabled: number
        quiet_hours_start: string
        quiet_hours_end: string
        calendar_integration: string
        memory_graph_path: string | null
      }, []>("SELECT * FROM user_preferences WHERE id = 1")
      .get()
    const onboardingRow = db
      .query<{ step_name: string; status: string }, []>(
        "SELECT step_name, status FROM onboarding_state WHERE step_name = 'ai-auth'",
      )
      .get()
    const overallStatus = db
      .query<{ value: string }, []>(
        "SELECT value FROM onboarding_meta WHERE key = 'overall_status'",
      )
      .get()
    const version = db
      .query<{ version: number }, []>("SELECT MAX(version) as version FROM schema_version")
      .get()

    expect(version?.version).toBe(17)
    expect(userPreferenceColumns).toContain("max_session_mins")
    expect(userPreferenceColumns).toContain("quiet_hours_start")
    expect(userPreferenceColumns).toContain("memory_graph_path")
    expect(onboardingColumns).toContain("step_name")
    expect(onboardingColumns).not.toContain("step")
    expect(db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'routines'").get()).toBeDefined()
    expect(userPreferenceRow).toEqual(expect.objectContaining({
      id: 1,
      study_times: "[\"morning\"]",
      course_ranking: "[\"course-a\"]",
      max_session_mins: 90,
      off_limit_days: "[]",
      notification_enabled: 0,
      quiet_hours_start: "23:00",
      quiet_hours_end: "07:00",
      calendar_integration: "none",
      memory_graph_path: null,
    }))
    expect(onboardingRow).toEqual({
      step_name: "ai-auth",
      status: "completed",
    })
    expect(overallStatus?.value).toBe("in_progress")

    db.close()
  })
})
