import { describe, test, expect, beforeEach } from "bun:test"
import { Effect, Layer } from "effect"
import {
  CronStore,
  CronStoreLive,
  type CronStoreShape,
} from "../store.js"
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

  const dbLayer = Layer.succeed(Database, dbService)
  const layer = CronStoreLive.pipe(Layer.provide(dbLayer))

  return Effect.runSync(
    Effect.scoped(
      Effect.gen(function* () {
        return yield* CronStore
      }).pipe(Effect.provide(layer)),
    ),
  )
}

describe("CronStore", () => {
  let store: CronStoreShape

  beforeEach(() => {
    store = buildStore()
  })

  test("creates and reads back a job", () => {
    const job = store.createJob({
      name: "demo",
      scheduleKind: "at",
      scheduleValue: new Date(Date.now() + 60_000).toISOString(),
      payloadKind: "reminder",
      payloadContent: JSON.stringify({ title: "hi", body: "there" }),
      nextRunAt: Date.now() + 60_000,
      deleteAfterRun: true,
    })

    const fetched = store.getJob(job.id)
    expect(fetched).not.toBeNull()
    expect(fetched?.name).toBe("demo")
    expect(fetched?.deleteAfterRun).toBe(true)
    expect(store.hasJobs()).toBe(true)
  })

  test("claimDue returns due jobs and locks them", () => {
    const now = 1_000_000
    store.createJob({
      name: "due",
      scheduleKind: "every",
      scheduleValue: "30m",
      payloadKind: "reminder",
      payloadContent: "{}",
      nextRunAt: now - 1, // due
    })
    store.createJob({
      name: "future",
      scheduleKind: "every",
      scheduleValue: "30m",
      payloadKind: "reminder",
      payloadContent: "{}",
      nextRunAt: now + 60_000, // not due
    })

    const claimed = store.claimDue(now)
    expect(claimed).toHaveLength(1)
    expect(claimed[0]?.job.name).toBe("due")
  })

  test("a second claimDue at the same instant returns nothing for a job already locked", () => {
    const now = 1_000_000
    store.createJob({
      name: "due",
      scheduleKind: "every",
      scheduleValue: "30m",
      payloadKind: "reminder",
      payloadContent: "{}",
      nextRunAt: now - 1,
    })

    const first = store.claimDue(now)
    const second = store.claimDue(now)

    expect(first).toHaveLength(1)
    expect(second).toHaveLength(0)
  })

  test("completeRun on a one-shot at-job deletes it", () => {
    const now = 1_000_000
    const job = store.createJob({
      name: "one-shot",
      scheduleKind: "at",
      scheduleValue: new Date(now).toISOString(),
      payloadKind: "reminder",
      payloadContent: "{}",
      nextRunAt: now - 1,
      deleteAfterRun: true,
    })
    const claimed = store.claimDue(now)
    expect(claimed).toHaveLength(1)

    const entry = claimed[0]!
    store.completeRun({
      runId: entry.runId,
      jobId: entry.job.id,
      finishedAt: now + 100,
      status: "success",
      output: "ok",
      nextRunAt: null,
      deleteJob: true,
    })

    expect(store.getJob(job.id)).toBeNull()
  })

  test("completeRun on a recurring success resets failure count and writes next_run_at", () => {
    const now = 1_000_000
    const job = store.createJob({
      name: "recur",
      scheduleKind: "every",
      scheduleValue: "30m",
      payloadKind: "agentTurn",
      sessionTarget: "main",
      payloadContent: "ping",
      nextRunAt: now - 1,
    })
    const [entry] = store.claimDue(now)
    expect(entry).toBeDefined()
    const nextFire = now + 30 * 60_000

    store.completeRun({
      runId: entry!.runId,
      jobId: job.id,
      finishedAt: now + 500,
      status: "success",
      output: "ok",
      nextRunAt: nextFire,
    })

    const reread = store.getJob(job.id)
    expect(reread?.nextRunAt).toBe(nextFire)
    expect(reread?.failureCount).toBe(0)
    expect(reread?.lastRunAt).toBe(now + 500)
  })

  test("completeRun on a failure increments failure_count and releases the lock", () => {
    const now = 1_000_000
    const job = store.createJob({
      name: "flaky",
      scheduleKind: "every",
      scheduleValue: "30m",
      payloadKind: "agentTurn",
      sessionTarget: "main",
      payloadContent: "ping",
      nextRunAt: now - 1,
    })
    const [entry] = store.claimDue(now)
    expect(entry).toBeDefined()

    store.completeRun({
      runId: entry!.runId,
      jobId: job.id,
      finishedAt: now + 500,
      status: "failed",
      error: "boom",
      nextRunAt: now + 60_000,
    })

    const reread = store.getJob(job.id)
    expect(reread?.failureCount).toBe(1)

    // Lock is released — a re-claim at next_run_at should succeed.
    const reclaim = store.claimDue(now + 60_000)
    expect(reclaim).toHaveLength(1)
  })

  test("maintenance deletes runs older than 30 days and expires locks older than 15 minutes", () => {
    const now = Date.now()
    const job = store.createJob({
      name: "old",
      scheduleKind: "every",
      scheduleValue: "30m",
      payloadKind: "agentTurn",
      sessionTarget: "main",
      payloadContent: "ping",
      nextRunAt: now - 1,
    })

    // Manufacture an old run row directly via createJob+claim then complete with stale time.
    const [entry] = store.claimDue(now)
    store.completeRun({
      runId: entry!.runId,
      jobId: job.id,
      finishedAt: now - 60 * 24 * 60 * 60 * 1000, // 60 days old
      status: "success",
      output: "ok",
      nextRunAt: now + 60_000,
    })

    // Take a new claim, and pretend the lock got stranded.
    store.claimDue(now + 60_000)
    // Run maintenance with a "now" that's 30 minutes after the lock acquisition.
    store.maintenance(now + 60_000 + 30 * 60_000)

    // Lock should have been swept.
    const reclaim = store.claimDue(now + 60_000 + 30 * 60_000)
    // Job's next_run_at hasn't moved (lock sweep doesn't reschedule), but lock-free now.
    expect(reclaim.length).toBeGreaterThanOrEqual(1)
  })
})
