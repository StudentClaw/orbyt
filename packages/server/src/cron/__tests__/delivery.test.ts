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
  test("deliverSuccess on a reminder writes a notify=true entry titled 'Orby' and publishes", async () => {
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
      job: makeJob({
        payloadContent: JSON.stringify({
          title: "calc review",
          body: "yo, 30 min on calc ch 5 to 7 right now sets up thursday",
        }),
      }),
      output: "",
    })

    const rows = dbService.query<{
      category: string
      title: string
      body: string
      notify: number
    }>(`SELECT category, title, body, notify FROM activity_feed`)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.category).toBe("reminder")
    expect(rows[0]?.title).toBe("Orby")
    expect(rows[0]?.body).toBe(
      "yo, 30 min on calc ch 5 to 7 right now sets up thursday",
    )
    expect(rows[0]?.notify).toBe(1)
    expect(published).toHaveLength(1)
  })

  test("reminder bodies have course codes simplified to the second segment", async () => {
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
        payloadContent: JSON.stringify({
          title: "lab prep",
          body: "yo, 2025FA_PHYS4B_LAB_SECTION_1 lab 8 due in 90 min",
        }),
      }),
      output: "",
    })

    const row = dbService.get<{ body: string }>(
      `SELECT body FROM activity_feed`,
    )
    expect(row?.body).toContain("PHYS4B")
    expect(row?.body).not.toContain("2025FA_PHYS4B_LAB_SECTION_1")
  })

  test("deliverSuccess on a generic agentTurn job uses 'cron' category", async () => {
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

  test("heartbeat success is a no-op in delivery (executor owns writes)", async () => {
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

  test("daily-insight success is a no-op in delivery (executor owns writes)", async () => {
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
      job: makeJob({ name: "daily-insight", payloadKind: "agentTurn" }),
      output: "INSIGHT: x | y",
    })

    const rows = dbService.query<{ id: string }>(`SELECT id FROM activity_feed`)
    expect(rows).toHaveLength(0)
  })

  test("heartbeat with arbitrary output is still a no-op in delivery", async () => {
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
    await delivery.deliverSuccess({
      job: makeJob({ name: "heartbeat", payloadKind: "agentTurn" }),
      output: "",
    })

    const rows = dbService.query<{ id: string }>(`SELECT id FROM activity_feed`)
    expect(rows).toHaveLength(0)
  })

  test("(legacy) generic 'agentTurn' job other than heartbeat/daily-insight still creates a card", async () => {
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
      job: makeJob({ name: "weekly-roundup", payloadKind: "agentTurn" }),
      output: "Some summary text for the week.",
    })

    const row = dbService.get<{ title: string; body: string; category: string }>(
      `SELECT title, body, category FROM activity_feed`,
    )
    expect(row?.category).toBe("cron")
    expect(row?.title).toBe("weekly-roundup")
    expect(row?.body).toContain("summary")
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
