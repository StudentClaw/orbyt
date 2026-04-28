import { describe, test, expect } from "bun:test"
import {
  generateWeeklyInsight,
  recordActivityEntry,
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
