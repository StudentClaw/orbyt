import { describe, test, expect } from "bun:test"
import { runMigrations } from "../db/migrations/runner.js"
import {
  generateWeeklyInsight,
  recordActivityEntry,
  recordWorkflowCompletionActivity,
} from "../activity/feed.js"
import { defaultConfig } from "../config/defaults.js"
import { createBunDatabaseService, createBunTestDatabase, runBunMigrations } from "./db-test-helpers.js"

function createDatabase() {
  const db = createBunTestDatabase(":memory:")
  db.run("PRAGMA journal_mode = WAL")
  db.run("PRAGMA foreign_keys = ON")
  runBunMigrations(db)
  return db
}

describe("activity feed", () => {
  test("records workflow completion entries and publishes the full payload", async () => {
    const db = createDatabase()
    const published: unknown[] = []
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO chat_workspaces (id, kind, name, root_path, availability, created_at, updated_at)
       VALUES ('workspace_1', 'legacy', 'Test Workspace', NULL, NULL, ?, ?)`,
      [now, now],
    )
    db.run(
      `INSERT INTO orchestration_threads (id, workspace_id, title, access_mode, status, current_turn_id, created_at, updated_at)
       VALUES ('thread_1', 'workspace_1', 'Test Thread', 'default', 'idle', NULL, ?, ?)`,
      [now, now],
    )

    const entry = await recordWorkflowCompletionActivity({
      database: createBunDatabaseService(db),
      pushBus: {
        registerClient: () => undefined,
        removeClient: () => undefined,
        subscribe: () => undefined,
        publish: async (_channel, data) => {
          published.push(data)
          return 1
        },
        publishTo: async () => 1,
        getLastSequence: () => 0,
      },
      turn: {
        id: "turn_1",
        threadId: "thread_1",
        output: "Finished the requested workflow successfully.",
      },
    })

    const rows = db.query<{
      id: string
      category: string
      type: string
      title: string
      body: string | null
      priority: number | null
      deep_link: string | null
    }, []>(
      "SELECT id, category, type, title, body, priority, deep_link FROM activity_feed",
    ).all()

    expect(entry).toMatchObject({
      category: "workflow",
      type: "workflow_completed",
      priority: 3,
      deepLink: "/chat/workspace_1/thread_1",
    })
    expect(rows).toEqual([
      {
        id: entry.id,
        category: "workflow",
        type: "workflow_completed",
        title: entry.title,
        body: entry.body ?? null,
        priority: 3,
        deep_link: "/chat/workspace_1/thread_1",
      },
    ])
    expect(published).toEqual([entry])
    db.close()
  })

  test("falls back to a deterministic weekly insight when Codex generation fails", async () => {
    const db = createDatabase()

    await recordActivityEntry({
      database: createBunDatabaseService(db),
      pushBus: {
        registerClient: () => undefined,
        removeClient: () => undefined,
        subscribe: () => undefined,
        publish: async () => 1,
        publishTo: async () => 1,
        getLastSequence: () => 0,
      },
      entry: {
        category: "workflow",
        type: "workflow_completed",
        title: "Workflow A complete",
        body: "A body",
        priority: 3,
        deepLink: "/chat",
      },
    })

    await recordActivityEntry({
      database: createBunDatabaseService(db),
      pushBus: {
        registerClient: () => undefined,
        removeClient: () => undefined,
        subscribe: () => undefined,
        publish: async () => 1,
        publishTo: async () => 1,
        getLastSequence: () => 0,
      },
      entry: {
        category: "insight",
        type: "weekly_summary",
        title: "Insight",
        body: "Insight body",
        priority: 1,
        deepLink: "/",
      },
    })

    const result = await generateWeeklyInsight({
      database: createBunDatabaseService(db),
      config: {
        ...defaultConfig,
        wsAuthToken: "a".repeat(64),
        codexBinaryPath: "/usr/bin/false",
      },
      now: new Date("2026-04-15T12:00:00.000Z"),
    })

    expect(result.weekKey).toBe("2026-04-13")
    expect(result.title).toContain("Weekly insight")
    expect(result.body).toContain("workflow")
    db.close()
  })
})
