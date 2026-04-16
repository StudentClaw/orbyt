import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database as BunDatabase } from "bun:sqlite"
import { mkdirSync, renameSync, rmdirSync } from "node:fs"
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

    const row = database.get<{ id: string; kind: string; root_path: string; availability: string }>(
      "SELECT id, kind, root_path, availability FROM chat_workspaces WHERE id = ?",
      [result.workspaceId],
    )

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
    const createdWorkspace = fsWorkspaces[0]

    expect(fsWorkspaces).toHaveLength(1)
    expect(createdWorkspace?.id).toBe(workspaceId)
    expect(createdWorkspace?.availability).toBe("ready")
  })

  test("createWorkspace is idempotent for the same path", async () => {
    const service = createOrchestrationService(makeDeps(database))
    const first = await service.createWorkspace("cmd-3a", tmpFolder)
    const second = await service.createWorkspace("cmd-3b", tmpFolder)

    expect(second.workspaceId).toBe(first.workspaceId)

    const count = database.get<{ n: number }>(
      "SELECT COUNT(*) as n FROM chat_workspaces WHERE root_path = ?",
      [tmpFolder],
    )

    expect(count?.n).toBe(1)
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

    const events = database.query<{ event_type: string }>(
      "SELECT event_type FROM orchestration_events WHERE command_id = ?",
      ["cmd-5"],
    )

    expect(events.some((e) => e.event_type === "workspace.created")).toBe(true)
  })

  test("createThread seeds the provider session cwd from the workspace root", async () => {
    const service = createOrchestrationService(makeDeps(database))
    const { workspaceId } = await service.createWorkspace("cmd-6", tmpFolder)
    const { threadId } = await service.createThread("cmd-7", workspaceId, "Scoped chat")

    const row = database.get<{ cwd: string | null; access_mode: string }>(
      `SELECT prs.cwd, ot.access_mode
       FROM provider_runtime_sessions prs
       JOIN orchestration_threads ot ON ot.id = prs.thread_id
       WHERE prs.thread_id = ?`,
      [threadId],
    )

    expect(row?.cwd).toBe(tmpFolder)
    expect(row?.access_mode).toBe("default")
  })

  test("relinkWorkspace updates thread session cwd and clears provider thread bindings", async () => {
    const service = createOrchestrationService(makeDeps(database))
    const { workspaceId } = await service.createWorkspace("cmd-8", tmpFolder)
    const { threadId } = await service.createThread("cmd-9", workspaceId, "Scoped chat")
    const relinkedFolder = `${tmpFolder}-relinked`
    renameSync(tmpFolder, relinkedFolder)

    db.run(
      "UPDATE provider_runtime_sessions SET provider_thread_id = ?, cwd = ? WHERE thread_id = ?",
      ["provider-thread-1", tmpFolder, threadId],
    )

    await service.relinkWorkspace("cmd-10", workspaceId, relinkedFolder)

    const row = database.get<{ provider_thread_id: string | null; cwd: string | null }>(
      "SELECT provider_thread_id, cwd FROM provider_runtime_sessions WHERE thread_id = ?",
      [threadId],
    )

    expect(row?.provider_thread_id).toBeNull()
    expect(row?.cwd).toBe(relinkedFolder)
    tmpFolder = relinkedFolder
  })

  test("renameThread updates the persisted thread title", async () => {
    const service = createOrchestrationService(makeDeps(database))
    const { workspaceId } = await service.createWorkspace("cmd-11", tmpFolder)
    const { threadId } = await service.createThread("cmd-12", workspaceId, "Original title")

    await service.renameThread("cmd-13", threadId, "Renamed title")

    const row = database.get<{ title: string }>(
      "SELECT title FROM orchestration_threads WHERE id = ?",
      [threadId],
    )

    expect(row?.title).toBe("Renamed title")
  })

  test("setThreadAccessMode persists the mode and clears bound provider threads", async () => {
    const service = createOrchestrationService(makeDeps(database))
    const { workspaceId } = await service.createWorkspace("cmd-13a", tmpFolder)
    const { threadId } = await service.createThread("cmd-13b", workspaceId, "Scoped chat")

    db.run(
      "UPDATE provider_runtime_sessions SET provider_thread_id = ?, last_error = ? WHERE thread_id = ?",
      ["provider-thread-1", "stale", threadId],
    )

    const result = await service.setThreadAccessMode("cmd-13c", threadId, "full")

    const threadRow = database.get<{ access_mode: string }>(
      "SELECT access_mode FROM orchestration_threads WHERE id = ?",
      [threadId],
    )
    const sessionRow = database.get<{ provider_thread_id: string | null; last_error: string | null }>(
      "SELECT provider_thread_id, last_error FROM provider_runtime_sessions WHERE thread_id = ?",
      [threadId],
    )

    expect(result).toEqual({ threadId, accessMode: "full" })
    expect(threadRow?.access_mode).toBe("full")
    expect(sessionRow?.provider_thread_id).toBeNull()
    expect(sessionRow?.last_error).toBeNull()
  })

  test("deleteThread removes the thread, its turns, and its runtime session", async () => {
    const service = createOrchestrationService(makeDeps(database))
    const { workspaceId } = await service.createWorkspace("cmd-14", tmpFolder)
    const { threadId } = await service.createThread("cmd-15", workspaceId, "Disposable chat")
    const now = new Date().toISOString()

    database.execute(
      `INSERT INTO orchestration_turns (
         id, thread_id, input_text, output_text, reasoning_text, status,
         started_at, completed_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["turn-test", threadId, "Hello", "", "", "pending", now, null, now],
    )
    database.execute(
      `UPDATE orchestration_threads
       SET current_turn_id = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      ["turn-test", "pending", now, threadId],
    )

    await service.deleteThread("cmd-17", threadId)

    const threadRow = database.get<{ id: string }>(
      "SELECT id FROM orchestration_threads WHERE id = ?",
      [threadId],
    )
    const turnCount = database.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM orchestration_turns WHERE thread_id = ?",
      [threadId],
    )
    const sessionRow = database.get<{ thread_id: string }>(
      "SELECT thread_id FROM provider_runtime_sessions WHERE thread_id = ?",
      [threadId],
    )

    expect(threadRow).toBeNull()
    expect(turnCount?.count).toBe(0)
    expect(sessionRow).toBeNull()
  })
})
