import { describe, test, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { CronStore, CronStoreLive, type CronStoreShape } from "../store.js"
import { createReminderJob } from "../reminder-tool.js"
import { Database } from "../../db/Database.js"
import {
  createBunDatabaseService,
  createBunTestDatabase,
  runBunMigrations,
} from "../../__tests__/db-test-helpers.js"

function buildStore(): CronStoreShape {
  const bun = createBunTestDatabase(":memory:")
  bun.run("PRAGMA journal_mode = WAL")
  bun.run("PRAGMA foreign_keys = ON")
  runBunMigrations(bun)
  const dbService = createBunDatabaseService(bun)
  const layer = CronStoreLive.pipe(Layer.provide(Layer.succeed(Database, dbService)))
  return Effect.runSync(
    Effect.gen(function* () {
      return yield* CronStore
    }).pipe(Effect.provide(layer)),
  )
}

describe("createReminderJob", () => {
  test("creates a one-shot reminder job in the future", () => {
    const store = buildStore()
    const future = new Date(Date.now() + 60_000).toISOString()
    const result = createReminderJob(store, {
      at: future,
      title: "Study CS",
      body: "Pull up the syllabus.",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.job.scheduleKind).toBe("at")
    expect(result.job.payloadKind).toBe("reminder")
    expect(result.job.deleteAfterRun).toBe(true)
    const parsed = JSON.parse(result.job.payloadContent) as {
      title: string
      body: string
    }
    expect(parsed.title).toBe("Study CS")
    expect(parsed.body).toBe("Pull up the syllabus.")
  })

  test("rejects empty title", () => {
    const store = buildStore()
    const result = createReminderJob(store, {
      at: new Date(Date.now() + 60_000).toISOString(),
      title: "   ",
      body: "ok",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain("title")
  })

  test("rejects past timestamp", () => {
    const store = buildStore()
    const result = createReminderJob(store, {
      at: new Date(Date.now() - 60_000).toISOString(),
      title: "x",
      body: "y",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain("future")
  })

  test("rejects malformed timestamp", () => {
    const store = buildStore()
    const result = createReminderJob(store, {
      at: "not-a-date",
      title: "x",
      body: "y",
    })
    expect(result.ok).toBe(false)
  })
})
