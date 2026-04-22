import { describe, test, expect, afterEach } from "bun:test"
import { mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { Database as BunDatabase } from "bun:sqlite"
import { createMemoryPaths } from "../memory/paths.js"
import { MemorizeStateStore } from "../memory/state-store.js"
import { LiveMemorizeTurnRunner } from "../memory/live-runner.js"
import type { DatabaseService } from "../db/Database.js"
import type { MemorizeDistiller } from "../memory/distiller.js"
import { createBunDatabaseService, runBunMigrations } from "./db-test-helpers.js"

const tempDirs: string[] = []

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "sc-integration-"))
  tempDirs.push(dir)

  const dbPath = join(dir, "test.db")
  const bunDb = new BunDatabase(dbPath)
  bunDb.run("PRAGMA journal_mode = WAL")
  runBunMigrations(bunDb)
  const db = createBunDatabaseService(bunDb)

  const paths = createMemoryPaths({ env: { STUDENT_CLAW_HOME: dir } })
  mkdirSync(paths.root, { recursive: true })
  const store = new MemorizeStateStore(paths)

  return { db, paths, store, dir }
}

afterEach(() => {
  for (const d of tempDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true })
  }
})

function mockDistiller(output = "### Notable Events\n\n- studied for exam\n"): MemorizeDistiller {
  return { distill: async () => output }
}

function seedTurn(
  db: DatabaseService,
  completedAt: string,
  opts: { id?: string; threadId?: string } = {},
): void {
  const threadId = opts.threadId ?? "thread_test"
  const turnId = opts.id ?? "turn_test"

  db.execute(
    `INSERT OR IGNORE INTO orchestration_threads (id, title, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [threadId, "Test Thread", "idle", completedAt, completedAt],
  )

  db.execute(
    `INSERT INTO orchestration_turns (id, thread_id, input_text, output_text, status, started_at, completed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [turnId, threadId, "What is CS?", "CS is...", "completed", completedAt, completedAt, completedAt],
  )
}

function seedCourse(db: DatabaseService, code = "CS 301", name = "Data Structures"): void {
  db.execute(
    `INSERT OR IGNORE INTO courses (id, name, code) VALUES (?, ?, ?)`,
    [`course_${code.replace(/\s+/g, "")}`, name, code],
  )
}

const NOW = new Date(2026, 3, 19, 7, 0)

describe("LiveMemorizeTurnRunner — integration with real SQLite DB", () => {
  test("writes daily file when completed turns exist", async () => {
    const { db, paths, store } = setup()
    seedTurn(db, "2026-04-19T06:00:00.000Z")

    const runner = new LiveMemorizeTurnRunner({ db, paths, store, distiller: mockDistiller() })
    const result = await runner.run({ sinceCursor: {}, now: NOW })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.dailyFileWritten).toBe("2026-04-19")
    expect(existsSync(paths.dailyFile("2026-04-19"))).toBe(true)
  })

  test("daily file contains distiller output", async () => {
    const { db, paths, store } = setup()
    seedTurn(db, "2026-04-19T06:00:00.000Z")

    const runner = new LiveMemorizeTurnRunner({
      db,
      paths,
      store,
      distiller: mockDistiller("### Notable Events\n\n- integration works\n"),
    })
    await runner.run({ sinceCursor: {}, now: NOW })

    const content = readFileSync(paths.dailyFile("2026-04-19"), "utf-8")
    expect(content).toContain("integration works")
  })

  test("advances global cursor to latest turn's completed_at", async () => {
    const { db, paths, store } = setup()
    seedTurn(db, "2026-04-19T06:00:00.000Z")
    seedTurn(db, "2026-04-19T06:30:00.000Z", { id: "turn_2", threadId: "thread_test" })

    const runner = new LiveMemorizeTurnRunner({ db, paths, store, distiller: mockDistiller() })
    await runner.run({ sinceCursor: {}, now: NOW })

    const state = store.read()
    expect(state.lastProcessedThreadCursor["_global"]).toBe("2026-04-19T06:30:00.000Z")
    expect(state.lastRunOutcome).toBe("success")
  })

  test("does not write daily file when no turns exist", async () => {
    const { db, paths, store } = setup()

    const runner = new LiveMemorizeTurnRunner({ db, paths, store, distiller: mockDistiller() })
    const result = await runner.run({ sinceCursor: {}, now: NOW })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.dailyFileWritten).toBeNull()
    expect(existsSync(paths.dailyFile("2026-04-19"))).toBe(false)
  })

  test("includes active courses in the prompt (no error when courses exist)", async () => {
    const { db, paths, store } = setup()
    seedTurn(db, "2026-04-19T06:00:00.000Z")
    seedCourse(db, "CS 301", "Data Structures")

    let capturedPrompt = ""
    const capturingDistiller: MemorizeDistiller = {
      distill: async (prompt) => {
        capturedPrompt = prompt
        return "### Notable Events\n\n- noted\n"
      },
    }

    const runner = new LiveMemorizeTurnRunner({ db, paths, store, distiller: capturingDistiller })
    await runner.run({ sinceCursor: {}, now: NOW })

    expect(capturedPrompt).toContain("CS 301")
    expect(capturedPrompt).toContain("Data Structures")
    expect(capturedPrompt).toContain("## Active Courses")
  })

  test("cursor prevents re-processing already-seen turns on subsequent run", async () => {
    const { db, paths, store } = setup()
    seedTurn(db, "2026-04-19T06:00:00.000Z")

    const runner = new LiveMemorizeTurnRunner({ db, paths, store, distiller: mockDistiller() })
    await runner.run({ sinceCursor: {}, now: NOW })

    // Second run: cursor is advanced — no new turns
    let distillCalled = false
    const trackingDistiller: MemorizeDistiller = {
      distill: async () => {
        distillCalled = true
        return "### Notable Events\n\n- nothing new\n"
      },
    }
    const runner2 = new LiveMemorizeTurnRunner({
      db,
      paths,
      store,
      distiller: trackingDistiller,
    })
    const state = store.read()
    await runner2.run({ sinceCursor: state.lastProcessedThreadCursor, now: new Date(2026, 3, 19, 20, 0) })

    expect(distillCalled).toBe(false)
  })
})
