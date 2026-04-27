import { describe, test, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { CronDelivery, CronDeliveryLive } from "../delivery.js"
import { Database } from "../../db/Database.js"
import { PushBus, type PushBusService } from "../../ws/PushBus.js"
import {
  createBunDatabaseService,
  createBunTestDatabase,
  runBunMigrations,
} from "../../__tests__/db-test-helpers.js"
import type { CronJob } from "@orbyt/contracts"

function makeJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: "cronjob_test",
    name: "test-job",
    scheduleKind: "at",
    scheduleValue: new Date().toISOString(),
    scheduleTz: null,
    sessionTarget: null,
    payloadKind: "reminder",
    payloadContent: JSON.stringify({ title: "Hi", body: "There" }),
    nextRunAt: null,
    lastRunAt: null,
    enabled: true,
    deleteAfterRun: true,
    failureCount: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe("CronDelivery", () => {
  test("deliverSuccess on a reminder writes a notify=true reminder activity entry and publishes", async () => {
    const bun = createBunTestDatabase(":memory:")
    runBunMigrations(bun)
    const dbService = createBunDatabaseService(bun)

    const published: unknown[] = []
    const pushStub: PushBusService = {
      registerClient: () => undefined,
      removeClient: () => undefined,
      subscribe: () => undefined,
      publish: async (_channel, data) => {
        published.push(data)
        return 1
      },
      publishTo: async () => 1,
      getLastSequence: () => 0,
    }

    const layer = CronDeliveryLive.pipe(
      Layer.provide(Layer.succeed(Database, dbService)),
      Layer.provide(Layer.succeed(PushBus, pushStub)),
    )

    const delivery = Effect.runSync(
      Effect.gen(function* () {
        return yield* CronDelivery
      }).pipe(Effect.provide(layer)),
    )

    await delivery.deliverSuccess({
      job: makeJob(),
      output: '{"title":"Hi","body":"There"}',
    })

    const rows = dbService.query<{
      category: string
      title: string
      body: string
      notify: number
    }>(`SELECT category, title, body, notify FROM activity_feed`)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.category).toBe("reminder")
    expect(rows[0]?.title).toBe("Hi")
    expect(rows[0]?.body).toBe("There")
    expect(rows[0]?.notify).toBe(1)
    expect(published).toHaveLength(1)
  })

  test("deliverSuccess on an agentTurn job uses 'cron' category", async () => {
    const bun = createBunTestDatabase(":memory:")
    runBunMigrations(bun)
    const dbService = createBunDatabaseService(bun)

    const pushStub: PushBusService = {
      registerClient: () => undefined,
      removeClient: () => undefined,
      subscribe: () => undefined,
      publish: async () => 1,
      publishTo: async () => 1,
      getLastSequence: () => 0,
    }

    const layer = CronDeliveryLive.pipe(
      Layer.provide(Layer.succeed(Database, dbService)),
      Layer.provide(Layer.succeed(PushBus, pushStub)),
    )
    const delivery = Effect.runSync(
      Effect.gen(function* () {
        return yield* CronDelivery
      }).pipe(Effect.provide(layer)),
    )

    await delivery.deliverSuccess({
      job: makeJob({
        name: "custom-job",
        payloadKind: "agentTurn",
        sessionTarget: "main",
      }),
      output: "all good, nothing to surface",
    })

    const row = dbService.get<{ category: string; title: string; notify: number }>(
      `SELECT category, title, notify FROM activity_feed`,
    )
    expect(row?.category).toBe("cron")
    expect(row?.title).toBe("custom-job")
    expect(row?.notify).toBe(1)
  })

  test("heartbeat success with HEARTBEAT_OK is suppressed entirely", async () => {
    const bun = createBunTestDatabase(":memory:")
    runBunMigrations(bun)
    const dbService = createBunDatabaseService(bun)

    const pushStub: PushBusService = {
      registerClient: () => undefined,
      removeClient: () => undefined,
      subscribe: () => undefined,
      publish: async () => 1,
      publishTo: async () => 1,
      getLastSequence: () => 0,
    }

    const layer = CronDeliveryLive.pipe(
      Layer.provide(Layer.succeed(Database, dbService)),
      Layer.provide(Layer.succeed(PushBus, pushStub)),
    )
    const delivery = Effect.runSync(
      Effect.gen(function* () {
        return yield* CronDelivery
      }).pipe(Effect.provide(layer)),
    )

    await delivery.deliverSuccess({
      job: makeJob({ name: "heartbeat", payloadKind: "agentTurn" }),
      output: "HEARTBEAT_OK",
    })

    const rows = dbService.query<{ id: string }>(`SELECT id FROM activity_feed`)
    expect(rows).toHaveLength(0)
  })

  test("heartbeat alert is recorded with title 'Heartbeat alert'", async () => {
    const bun = createBunTestDatabase(":memory:")
    runBunMigrations(bun)
    const dbService = createBunDatabaseService(bun)

    const pushStub: PushBusService = {
      registerClient: () => undefined,
      removeClient: () => undefined,
      subscribe: () => undefined,
      publish: async () => 1,
      publishTo: async () => 1,
      getLastSequence: () => 0,
    }

    const layer = CronDeliveryLive.pipe(
      Layer.provide(Layer.succeed(Database, dbService)),
      Layer.provide(Layer.succeed(PushBus, pushStub)),
    )
    const delivery = Effect.runSync(
      Effect.gen(function* () {
        return yield* CronDelivery
      }).pipe(Effect.provide(layer)),
    )

    await delivery.deliverSuccess({
      job: makeJob({ name: "heartbeat", payloadKind: "agentTurn" }),
      output: "Calc 3 deadline tonight you should plan now.",
    })

    const row = dbService.get<{ title: string; body: string }>(
      `SELECT title, body FROM activity_feed`,
    )
    expect(row?.title).toBe("Heartbeat alert")
    expect(row?.body).toContain("Calc 3 deadline")
  })

  test("deliverFailure writes a non-notifying entry", async () => {
    const bun = createBunTestDatabase(":memory:")
    runBunMigrations(bun)
    const dbService = createBunDatabaseService(bun)

    const pushStub: PushBusService = {
      registerClient: () => undefined,
      removeClient: () => undefined,
      subscribe: () => undefined,
      publish: async () => 1,
      publishTo: async () => 1,
      getLastSequence: () => 0,
    }

    const layer = CronDeliveryLive.pipe(
      Layer.provide(Layer.succeed(Database, dbService)),
      Layer.provide(Layer.succeed(PushBus, pushStub)),
    )
    const delivery = Effect.runSync(
      Effect.gen(function* () {
        return yield* CronDelivery
      }).pipe(Effect.provide(layer)),
    )

    await delivery.deliverFailure({
      job: makeJob({ name: "broken" }),
      error: "API exploded",
    })

    const row = dbService.get<{ category: string; title: string; notify: number }>(
      `SELECT category, title, notify FROM activity_feed`,
    )
    expect(row?.category).toBe("cron")
    expect(row?.title).toBe("broken failed")
    expect(row?.notify).toBe(0)
  })
})
