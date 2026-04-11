import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database as BunDatabase } from "bun:sqlite"
import { mkdirSync, rmdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runMigrations } from "../db/migrations/runner.js"
import type { DatabaseService } from "../db/Database.js"
import type { PushBusService } from "../ws/PushBus.js"
import type { ServerReadinessService } from "../runtime/ServerReadiness.js"
import type { RuntimeReceiptBusService } from "../orchestration/RuntimeReceiptBus.js"
import {
  createOrchestrationService,
  createRuntimeState,
  type OrchestrationRuntimeDeps,
} from "../orchestration/OrchestrationService.js"
import { defaultConfig } from "../config/defaults.js"

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeDatabaseService(db: BunDatabase): DatabaseService {
  return {
    db,
    get: <T>(sql: string, params: unknown[] = []): T | null =>
      (db.query(sql).get(...(params as Parameters<typeof db.query>[0][])) as T | null) ?? null,
    query: <T>(sql: string, params: unknown[] = []): T[] =>
      db.query(sql).all(...(params as Parameters<typeof db.query>[0][])) as T[],
    execute: (sql: string, params: unknown[] = []): void => {
      db.run(sql, params as Parameters<typeof db.run>[1])
    },
    transaction: <T>(fn: () => T): T => db.transaction(fn)(),
    close: () => db.close(),
  }
}

function makeMockPushBus(): PushBusService {
  return {
    registerClient: () => undefined,
    removeClient: () => undefined,
    subscribe: () => undefined,
    publish: async () => 1,
    publishTo: async () => 1,
    getLastSequence: () => 0,
  }
}

function makeMockReadiness(): ServerReadinessService {
  return {
    awaitReady: async () => undefined,
    markReady: () => undefined,
    isReady: () => true,
  }
}

function makeMockReceiptBus(): RuntimeReceiptBusService {
  return {
    track: async () => undefined,
    resolve: async () => undefined,
    waitFor: async () => ({}),
  }
}

function makeDeps(database: DatabaseService): OrchestrationRuntimeDeps {
  return {
    config: {
      ...defaultConfig,
      port: 0,
      wsHost: "127.0.0.1",
      wsAuthToken: "a".repeat(64),
      dbPath: ":memory:",
    },
    database,
    pushBus: makeMockPushBus(),
    readiness: makeMockReadiness(),
    receiptBus: makeMockReceiptBus(),
    state: createRuntimeState(),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("workspace operations", () => {
  let db: BunDatabase
  let database: DatabaseService
  let tmpFolder: string

  beforeEach(() => {
    db = new BunDatabase(":memory:")
    db.run("PRAGMA journal_mode = WAL")
    db.run("PRAGMA foreign_keys = ON")
    runMigrations(db)
    database = makeDatabaseService(db)

    tmpFolder = join(tmpdir(), `student-claw-test-${Date.now()}`)
    mkdirSync(tmpFolder, { recursive: true })
  })

  afterEach(() => {
    db.close()
    try {
      rmdirSync(tmpFolder, { recursive: true } as Parameters<typeof rmdirSync>[1])
    } catch {
      // ignore cleanup errors
    }
  })

  test("createWorkspace persists the folder and returns a workspaceId", async () => {
    const service = createOrchestrationService(makeDeps(database))
    const result = await service.createWorkspace("cmd-1", tmpFolder)

    expect(result.workspaceId).toBeTruthy()

    const row = db
      .query<{ id: string; kind: string; root_path: string; availability: string }, []>(
        "SELECT id, kind, root_path, availability FROM chat_workspaces WHERE id = ?",
      )
      .get(result.workspaceId)

    expect(row).not.toBeNull()
    expect(row!.kind).toBe("filesystem")
    expect(row!.root_path).toBeTruthy()
    expect(row!.availability).toBe("ready")
  })

  test("getSnapshot includes the workspace after createWorkspace", async () => {
    const service = createOrchestrationService(makeDeps(database))
    const { workspaceId } = await service.createWorkspace("cmd-2", tmpFolder)

    const snapshot = await service.getSnapshot()
    const fsWorkspaces = snapshot.workspaces.filter((w) => w.kind === "filesystem")

    expect(fsWorkspaces).toHaveLength(1)
    expect(fsWorkspaces[0].id).toBe(workspaceId)
    expect(fsWorkspaces[0].availability).toBe("ready")
  })

  test("createWorkspace is idempotent for the same path", async () => {
    const service = createOrchestrationService(makeDeps(database))
    const first = await service.createWorkspace("cmd-3a", tmpFolder)
    const second = await service.createWorkspace("cmd-3b", tmpFolder)

    expect(second.workspaceId).toBe(first.workspaceId)

    const count = db
      .query<{ n: number }, []>(
        "SELECT COUNT(*) as n FROM chat_workspaces WHERE root_path = ?",
      )
      .get(tmpFolder)

    expect(count!.n).toBe(1)
  })

  test("createWorkspace throws when the path does not exist", async () => {
    const service = createOrchestrationService(makeDeps(database))
    const missingPath = join(tmpdir(), `does-not-exist-${Date.now()}`)

    await expect(service.createWorkspace("cmd-4", missingPath)).rejects.toThrow(
      /Workspace folder not found/,
    )
  })

  test("getSnapshot returns no filesystem workspaces before any folder is added", async () => {
    const service = createOrchestrationService(makeDeps(database))
    const snapshot = await service.getSnapshot()
    const fsWorkspaces = snapshot.workspaces.filter((w) => w.kind === "filesystem")

    expect(fsWorkspaces).toHaveLength(0)
    expect(snapshot.threads).toHaveLength(0)
  })

  test("createWorkspace records an event in orchestration_events", async () => {
    const service = createOrchestrationService(makeDeps(database))
    await service.createWorkspace("cmd-5", tmpFolder)

    const events = db
      .query<{ event_type: string }, []>(
        "SELECT event_type FROM orchestration_events WHERE command_id = ?",
      )
      .all("cmd-5")

    expect(events.some((e) => e.event_type === "workspace.created")).toBe(true)
  })
})
