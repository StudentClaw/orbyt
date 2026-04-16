import { describe, test, expect } from "bun:test"
import { Database as BunDatabase, type SQLQueryBindings } from "bun:sqlite"
import { RPC_METHODS } from "@student-claw/contracts"
import { routeMessage } from "../ws/Router.js"
import { defaultConfig } from "../config/defaults.js"
import { runMigrations } from "../db/migrations/runner.js"

const mockWs = { readyState: 1, send: () => undefined } as never

function makeDependencies() {
  const db = new BunDatabase(":memory:")
  runMigrations(db)
  return {
    config: {
      ...defaultConfig,
      wsAuthToken: "a".repeat(64),
      codexBinaryPath: "/usr/bin/false",
    },
    readiness: {
      awaitReady: async () => undefined,
      markReady: () => undefined,
      isReady: () => true,
    },
    pushBus: {
      registerClient: () => undefined,
      removeClient: () => undefined,
      subscribe: () => undefined,
      publish: async () => 1,
      publishTo: async () => 1,
      getLastSequence: () => 1,
    },
    orchestration: {
      getDesktopBootstrap: async () => ({
        wsUrl: "ws://127.0.0.1:8787",
        wsAuthToken: "a".repeat(64),
        appVersion: "0.1.0",
        platform: "test",
        featureFlags: { pluginSystem: false },
      }),
      getServerConfig: async () => ({
        appVersion: "0.1.0",
        platform: "test",
        protocolVersion: "rpc-v1",
        capabilities: { orchestration: true, providerRuntime: true, desktopBootstrap: true },
        defaultChatModel: "gpt-5.4-mini",
        chatModels: [],
        featureFlags: { pluginSystem: false },
      }),
      getSnapshot: async () => ({
        workspaces: [],
        threads: [],
        turns: [],
        pendingApprovals: [],
        providerStatus: "idle" as const,
        providerRuntime: {
          adapter: "codex" as const,
          status: "idle" as const,
          authState: "authenticated" as const,
          lastError: null,
          queuedTurnCount: 0,
          lastUpdatedAt: "2026-04-16T00:00:00.000Z",
        },
        ready: true,
        lastSequence: 1,
      }),
      createWorkspace: async () => ({ workspaceId: "w1" as never }),
      relinkWorkspace: async () => ({ workspaceId: "w1" as never }),
      deleteWorkspace: async () => ({ deleted: true }),
      createThread: async () => ({ threadId: "t1" as never }),
      renameThread: async () => ({ threadId: "t1" as never }),
      deleteThread: async () => ({ deleted: true }),
      setThreadAccessMode: async () => ({ threadId: "t1" as never, accessMode: "default" as const }),
      sendTurn: async () => ({ turnId: "turn1" as never }),
      interruptTurn: async () => ({ interrupted: true }),
      startProviderAuth: async () => ({ started: true }),
      retryProviderInitialize: async () => ({ started: true }),
      respondToProviderApproval: async () => ({ approvalRequestId: "a1", resolved: true }),
    },
    database: {
      db,
      get: <T>(sql: string, params: SQLQueryBindings[] = []) => db.query(sql).get(...params) as T | null,
      query: <T>(sql: string, params: SQLQueryBindings[] = []) => db.query(sql).all(...params) as T[],
      execute: (sql: string, params: SQLQueryBindings[] = []) => { db.run(sql, params as never) },
      transaction: <T>(fn: () => T) => fn(),
      close: () => db.close(),
    },
  }
}

function rpc(method: string, params: unknown, id = "test-1") {
  return JSON.stringify({ kind: "request", method, id, params })
}

describe("onboarding.getPreferences", () => {
  test("returns defaults when no row exists", async () => {
    const deps = makeDependencies()
    const raw = await routeMessage(rpc(RPC_METHODS.ONBOARDING_GET_PREFERENCES, {}), mockWs, deps)
    const res = JSON.parse(raw.response)
    expect(res.ok).toBe(true)
    expect(res.result.studyTimes).toEqual([])
    expect(res.result.maxSessionMins).toBe(90)
    expect(res.result.notificationEnabled).toBe(true)
    expect(res.result.quietHoursStart).toBe("22:00")
    expect(res.result.quietHoursEnd).toBe("08:00")
    expect(res.result.calendarIntegration).toBe("none")
  })

  test("returns persisted values after setPreferences", async () => {
    const deps = makeDependencies()

    await routeMessage(rpc(RPC_METHODS.ONBOARDING_SET_PREFERENCES, {
      studyTimes: ["morning", "evening"],
      maxSessionMins: 120,
      notificationEnabled: false,
      quietHoursStart: "23:00",
      quietHoursEnd: "07:00",
    }), mockWs, deps)

    const raw = await routeMessage(rpc(RPC_METHODS.ONBOARDING_GET_PREFERENCES, {}), mockWs, deps)
    const res = JSON.parse(raw.response)
    expect(res.ok).toBe(true)
    expect(res.result.studyTimes).toEqual(["morning", "evening"])
    expect(res.result.maxSessionMins).toBe(120)
    expect(res.result.notificationEnabled).toBe(false)
    expect(res.result.quietHoursStart).toBe("23:00")
    expect(res.result.quietHoursEnd).toBe("07:00")
  })
})

describe("onboarding.setPreferences", () => {
  test("persists values and returns updated StudentPreference", async () => {
    const deps = makeDependencies()
    const raw = await routeMessage(rpc(RPC_METHODS.ONBOARDING_SET_PREFERENCES, {
      studyTimes: ["afternoon"],
      maxSessionMins: 60,
      offLimitDays: [5, 6],
      notificationEnabled: true,
      quietHoursStart: "21:00",
      quietHoursEnd: "09:00",
      calendarIntegration: "google",
    }), mockWs, deps)
    const res = JSON.parse(raw.response)
    expect(res.ok).toBe(true)
    expect(res.result.studyTimes).toEqual(["afternoon"])
    expect(res.result.maxSessionMins).toBe(60)
    expect(res.result.offLimitDays).toEqual([5, 6])
    expect(res.result.calendarIntegration).toBe("google")
  })

  test("partial update merges with existing values", async () => {
    const deps = makeDependencies()

    await routeMessage(rpc(RPC_METHODS.ONBOARDING_SET_PREFERENCES, {
      maxSessionMins: 90,
      studyTimes: ["morning"],
    }), mockWs, deps)

    await routeMessage(rpc(RPC_METHODS.ONBOARDING_SET_PREFERENCES, {
      maxSessionMins: 120,
    }), mockWs, deps)

    const raw = await routeMessage(rpc(RPC_METHODS.ONBOARDING_GET_PREFERENCES, {}), mockWs, deps)
    const res = JSON.parse(raw.response)
    expect(res.result.maxSessionMins).toBe(120)
    expect(res.result.studyTimes).toEqual(["morning"])
  })

  test("returns error on invalid params", async () => {
    const deps = makeDependencies()
    const raw = await routeMessage(rpc(RPC_METHODS.ONBOARDING_SET_PREFERENCES, {
      maxSessionMins: "not-a-number",
    }), mockWs, deps)
    const res = JSON.parse(raw.response)
    expect(res.ok).toBe(false)
  })
})

describe("onboarding.getRoutines", () => {
  test("returns empty cells when none set", async () => {
    const deps = makeDependencies()
    const raw = await routeMessage(rpc(RPC_METHODS.ONBOARDING_GET_ROUTINES, {}), mockWs, deps)
    const res = JSON.parse(raw.response)
    expect(res.ok).toBe(true)
    expect(res.result.cells).toEqual([])
  })

  test("returns persisted cells after setRoutines", async () => {
    const deps = makeDependencies()

    await routeMessage(rpc(RPC_METHODS.ONBOARDING_SET_ROUTINES, {
      cells: [
        { dayOfWeek: 0, hourOfDay: 9 },
        { dayOfWeek: 2, hourOfDay: 14 },
      ],
    }), mockWs, deps)

    const raw = await routeMessage(rpc(RPC_METHODS.ONBOARDING_GET_ROUTINES, {}), mockWs, deps)
    const res = JSON.parse(raw.response)
    expect(res.ok).toBe(true)
    expect(res.result.cells).toHaveLength(2)
    expect(res.result.cells).toContainEqual({ dayOfWeek: 0, hourOfDay: 9 })
    expect(res.result.cells).toContainEqual({ dayOfWeek: 2, hourOfDay: 14 })
  })
})

describe("onboarding.setRoutines", () => {
  test("replaces all existing routines and returns count", async () => {
    const deps = makeDependencies()

    await routeMessage(rpc(RPC_METHODS.ONBOARDING_SET_ROUTINES, {
      cells: [
        { dayOfWeek: 0, hourOfDay: 8 },
        { dayOfWeek: 1, hourOfDay: 9 },
        { dayOfWeek: 2, hourOfDay: 10 },
      ],
    }), mockWs, deps)

    const raw = await routeMessage(rpc(RPC_METHODS.ONBOARDING_SET_ROUTINES, {
      cells: [{ dayOfWeek: 4, hourOfDay: 16 }],
    }), mockWs, deps)
    const res = JSON.parse(raw.response)
    expect(res.ok).toBe(true)
    expect(res.result.count).toBe(1)

    const getRes = JSON.parse(
      (await routeMessage(rpc(RPC_METHODS.ONBOARDING_GET_ROUTINES, {}), mockWs, deps)).response,
    )
    expect(getRes.result.cells).toEqual([{ dayOfWeek: 4, hourOfDay: 16 }])
  })

  test("accepts empty cells (clears all routines)", async () => {
    const deps = makeDependencies()

    await routeMessage(rpc(RPC_METHODS.ONBOARDING_SET_ROUTINES, {
      cells: [{ dayOfWeek: 0, hourOfDay: 9 }],
    }), mockWs, deps)

    const raw = await routeMessage(rpc(RPC_METHODS.ONBOARDING_SET_ROUTINES, {
      cells: [],
    }), mockWs, deps)
    const res = JSON.parse(raw.response)
    expect(res.ok).toBe(true)
    expect(res.result.count).toBe(0)
  })
})
