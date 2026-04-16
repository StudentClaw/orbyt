import { describe, test, expect } from "bun:test"
import { Database as BunDatabase, type SQLQueryBindings } from "bun:sqlite"
import { runMigrations } from "../db/migrations/runner.js"
import {
  generateWeeklyInsight,
  recordActivityEntry,
  recordWorkflowCompletionActivity,
} from "../activity/feed.js"
import { defaultConfig } from "../config/defaults.js"

function createDatabase(): BunDatabase {
  const db = new BunDatabase(":memory:")
  db.run("PRAGMA journal_mode = WAL")
  db.run("PRAGMA foreign_keys = ON")
  runMigrations(db)
  return db
}

function createDatabaseService(db: BunDatabase) {
  return {
    db,
    get: <T>(sql: string, params: SQLQueryBindings[] = []) => db.query(sql).get(...params) as T | null,
    query: <T>(sql: string, params: SQLQueryBindings[] = []) => db.query(sql).all(...params) as T[],
    execute: (sql: string, params: SQLQueryBindings[] = []) => {
      db.run(sql, params as never)
    },
    transaction: <T>(fn: () => T) => fn(),
    close: () => db.close(),
  }
}

describe("activity feed", () => {
  test("records workflow completion entries and publishes the full payload", async () => {
    const db = createDatabase()
    const published: unknown[] = []

    const entry = await recordWorkflowCompletionActivity({
      database: createDatabaseService(db),
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
      deepLink: "/chat",
    })
    expect(rows).toEqual([
      {
        id: entry.id,
        category: "workflow",
        type: "workflow_completed",
        title: entry.title,
        body: entry.body ?? null,
        priority: 3,
        deep_link: "/chat",
      },
    ])
    expect(published).toEqual([entry])
    db.close()
  })

  test("falls back to a deterministic weekly insight when Codex generation fails", async () => {
    const db = createDatabase()

    await recordActivityEntry({
      database: createDatabaseService(db),
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
      database: createDatabaseService(db),
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
      database: createDatabaseService(db),
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
