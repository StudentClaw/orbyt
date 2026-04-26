import { describe, test, expect } from "bun:test"
import { Effect, Layer } from "effect"
import {
  CronScheduler,
  CronSchedulerLive,
  type CronSchedulerShape,
} from "../scheduler.js"
import {
  CronStore,
  CronStoreLive,
  type CronStoreShape,
} from "../store.js"
import { CronExecutor, type ExecutionResult } from "../executor.js"
import { CronDelivery } from "../delivery.js"
import { ProactiveMemory } from "../../proactive/index.js"
import { Database } from "../../db/Database.js"
import {
  createBunDatabaseService,
  createBunTestDatabase,
  runBunMigrations,
} from "../../__tests__/db-test-helpers.js"
import type { CronJob } from "@orbyt/contracts"

interface Harness {
  store: CronStoreShape
  scheduler: CronSchedulerShape
  recorded: CronJob[]
}

function buildHarness(executorImpl?: (job: CronJob) => Promise<ExecutionResult>): Harness {
  const bun = createBunTestDatabase(":memory:")
  bun.run("PRAGMA journal_mode = WAL")
  bun.run("PRAGMA foreign_keys = ON")
  runBunMigrations(bun)
  const dbService = createBunDatabaseService(bun)

  const dbLayer = Layer.succeed(Database, dbService)
  const recorded: CronJob[] = []
  const executor = executorImpl ?? (async (job: CronJob): Promise<ExecutionResult> => {
    recorded.push(job)
    return { status: "success", output: `ran ${job.id}` }
  })
  const executorLayer = Layer.succeed(CronExecutor, { run: executor })

  // Stub delivery — tests don't care about side-effects from it; the scheduler just needs the dep.
  const deliveryLayer = Layer.succeed(CronDelivery, {
    deliverSuccess: async () => undefined,
    deliverFailure: async () => undefined,
  })

  // Stub proactive memory — scheduler only calls pruneExpired().
  const memoryLayer = Layer.succeed(ProactiveMemory, {
    paths: {
      root: "/tmp",
      soulFile: "/tmp/SOUL.md",
      heartbeatFile: "/tmp/HEARTBEAT.md",
      workingBufferFile: "/tmp/WORKING_BUFFER.md",
      sessionsDir: "/tmp/sessions",
      sessionDir: () => "/tmp/sessions/x",
    },
    readSoul: () => "",
    writeSoul: () => ({ ok: true, wordCount: 0 }),
    addNote: () => ({ id: "wb_x", plantedAt: "", expiresAt: "", text: "" }),
    clearNote: () => false,
    listActiveNotes: () => [],
    pruneExpired: () => ({ removed: 0, remaining: 0 }),
    ensureScaffold: () => undefined,
  })

  const layer = Layer.mergeAll(
    CronStoreLive.pipe(Layer.provide(dbLayer)),
    executorLayer,
    deliveryLayer,
    memoryLayer,
    CronSchedulerLive.pipe(
      Layer.provide(CronStoreLive.pipe(Layer.provide(dbLayer))),
      Layer.provide(executorLayer),
      Layer.provide(deliveryLayer),
      Layer.provide(memoryLayer),
    ),
  )

  const { store, scheduler } = Effect.runSync(
    Effect.gen(function* () {
      const store = yield* CronStore
      const scheduler = yield* CronScheduler
      return { store, scheduler }
    }).pipe(Effect.provide(layer)),
  )

  return { store, scheduler, recorded }
}

describe("CronScheduler", () => {
  test("tick claims due jobs, dispatches them, and clears next_run_at for one-shot at-jobs", async () => {
    const { store, scheduler, recorded } = buildHarness()
    const now = Date.now()
    const job = store.createJob({
      name: "one-shot",
      scheduleKind: "at",
      scheduleValue: new Date(now).toISOString(),
      payloadKind: "reminder",
      payloadContent: JSON.stringify({ title: "t", body: "b" }),
      nextRunAt: now - 1,
      deleteAfterRun: true,
    })

    await scheduler.tick(now)

    expect(recorded).toHaveLength(1)
    expect(recorded[0]?.id).toBe(job.id)
    // delete_after_run = true → row is gone
    expect(store.getJob(job.id)).toBeNull()
  })

  test("tick on a recurring job rolls next_run_at by the every-interval", async () => {
    const { store, scheduler, recorded } = buildHarness()
    const now = Date.now()
    const job = store.createJob({
      name: "recur",
      scheduleKind: "every",
      scheduleValue: "30m",
      payloadKind: "agentTurn",
      sessionTarget: "main",
      payloadContent: "ping",
      nextRunAt: now - 1,
    })

    await scheduler.tick(now)

    expect(recorded).toHaveLength(1)
    const reread = store.getJob(job.id)
    expect(reread).not.toBeNull()
    // next_run_at is computed from finish (~now), not scheduled (now-1) → ≈ now + 30m
    const delta = (reread!.nextRunAt ?? 0) - now
    expect(delta).toBeGreaterThan(29 * 60_000)
    expect(delta).toBeLessThan(31 * 60_000)
  })

  test("tick is reentrant-safe: concurrent ticks coalesce", async () => {
    const { store, scheduler, recorded } = buildHarness()
    const now = Date.now()
    for (let i = 0; i < 5; i += 1) {
      store.createJob({
        name: `r${i}`,
        scheduleKind: "at",
        scheduleValue: new Date(now).toISOString(),
        payloadKind: "reminder",
        payloadContent: "{}",
        nextRunAt: now - 1,
        deleteAfterRun: true,
      })
    }
    await Promise.all([scheduler.tick(now), scheduler.tick(now), scheduler.tick(now)])
    // Each job runs at most once even though three ticks fired together.
    const ids = new Set(recorded.map((j) => j.id))
    expect(ids.size).toBe(5)
    expect(recorded.length).toBe(5)
  })

  test("an executor exception is recorded as a failed run, not a crash", async () => {
    const { store, scheduler } = buildHarness(async () => {
      throw new Error("kaboom")
    })
    const now = Date.now()
    const job = store.createJob({
      name: "explode",
      scheduleKind: "every",
      scheduleValue: "30m",
      payloadKind: "agentTurn",
      sessionTarget: "main",
      payloadContent: "ping",
      nextRunAt: now - 1,
    })

    await scheduler.tick(now)

    const reread = store.getJob(job.id)
    expect(reread?.failureCount).toBe(1)
  })
})
