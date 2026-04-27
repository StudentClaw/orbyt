import { describe, test, expect, afterEach } from "bun:test"
import { mkdtempSync, rmSync, mkdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createMemoryPaths } from "../memory/paths.js"
import { MemorizeStateStore } from "../memory/state-store.js"
import { LiveMemorizeTurnRunner } from "../memory/live-runner.js"
import type { MemorizeDistiller } from "../memory/distiller.js"
import type { DatabaseService } from "../db/Database.js"

const tempDirs: string[] = []
type QueryParams = Parameters<DatabaseService["query"]>[1]

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "sc-live-runner-"))
  tempDirs.push(dir)
  const paths = createMemoryPaths({ env: { ORBYT_HOME: dir } })
  mkdirSync(paths.root, { recursive: true })
  const store = new MemorizeStateStore(paths)
  return { paths, store, dir }
}

afterEach(() => {
  for (const d of tempDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true })
  }
})

function mockDb(turns: { id: string; thread_id: string; input_text: string; output_text: string; completed_at: string }[]): DatabaseService {
  return {
    get: <T>(_sql: string, _params?: QueryParams) => null as T | null,
    query: <T>(_sql: string, _params?: QueryParams) => turns as unknown as T[],
    execute: () => {},
    transaction: <T>(fn: () => T) => fn(),
    close: () => {},
  }
}

function mockDistiller(output = "### Notable Events\n\n- test event\n"): MemorizeDistiller {
  return { distill: async () => output }
}

describe("LiveMemorizeTurnRunner", () => {
  test("succeeds with no turns — no daily file written", async () => {
    const { paths, store } = setup()
    const runner = new LiveMemorizeTurnRunner({
      db: mockDb([]),
      paths,
      store,
      distiller: mockDistiller(),
    })

    const result = await runner.run({
      sinceCursor: {},
      now: new Date(2026, 3, 19, 7, 0),
      trigger: "manual",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.dailyFileWritten).toBeNull()
    expect(existsSync(paths.dailyFile("2026-04-19"))).toBe(false)
  })

  test("writes daily file when turns are present", async () => {
    const { paths, store } = setup()
    const runner = new LiveMemorizeTurnRunner({
      db: mockDb([
        {
          id: "t1",
          thread_id: "th1",
          input_text: "help with cs301",
          output_text: "sure",
          completed_at: "2026-04-19T06:00:00.000Z",
        },
      ]),
      paths,
      store,
      distiller: mockDistiller(),
    })

    const result = await runner.run({
      sinceCursor: {},
      now: new Date(2026, 3, 19, 7, 0),
      trigger: "manual",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.dailyFileWritten).toBe("2026-04-19")
    expect(existsSync(paths.dailyFile("2026-04-19"))).toBe(true)
  })

  test("advances cursor after successful run", async () => {
    const { paths, store } = setup()
    const runner = new LiveMemorizeTurnRunner({
      db: mockDb([
        {
          id: "t1",
          thread_id: "th1",
          input_text: "q",
          output_text: "a",
          completed_at: "2026-04-19T06:00:00.000Z",
        },
      ]),
      paths,
      store,
      distiller: mockDistiller(),
    })

    await runner.run({ sinceCursor: {}, now: new Date(2026, 3, 19, 7, 0), trigger: "manual" })

    const state = store.read()
    expect(state.lastRunOutcome).toBe("success")
    expect(state.lastProcessedThreadCursor["_global"]).toBe("2026-04-19T06:00:00.000Z")
  })

  test("appends new turns to existing daily file on second run same day", async () => {
    const { paths, store } = setup()
    const now = new Date(2026, 3, 19, 7, 0)

    // First run — writes the daily file
    const runner1 = new LiveMemorizeTurnRunner({
      db: mockDb([
        { id: "t1", thread_id: "th1", input_text: "morning q", output_text: "morning a", completed_at: "2026-04-19T06:00:00.000Z" },
      ]),
      paths,
      store,
      distiller: mockDistiller("### Notable Events\n\n- morning event\n"),
    })
    await runner1.run({ sinceCursor: {}, now, trigger: "auto" })

    const cursor = store.read().lastProcessedThreadCursor

    // Second run — new turn arrived after first run
    let secondDistillCalled = false
    const runner2 = new LiveMemorizeTurnRunner({
      db: mockDb([
        { id: "t2", thread_id: "th1", input_text: "afternoon q", output_text: "afternoon a", completed_at: "2026-04-19T10:00:00.000Z" },
      ]),
      paths,
      store,
      distiller: { distill: async () => { secondDistillCalled = true; return "### Notable Events\n\n- afternoon event\n" } },
    })
    const result2 = await runner2.run({ sinceCursor: cursor, now, trigger: "auto" })

    expect(result2.ok).toBe(true)
    expect(secondDistillCalled).toBe(true)
    if (!result2.ok) return
    expect(result2.result.dailyFileWritten).toBe("2026-04-19")
  })

  test("records failure and preserves prior checkpoint on distiller error", async () => {
    const { paths, store } = setup()
    store.commitSuccess({
      lastRunAt: "2026-04-18T07:00:00.000Z",
      lastProcessedThreadCursor: { "_global": "2026-04-18T06:00:00.000Z" },
      lastDailyFile: "2026-04-18",
      lastWeeklyFile: "2026-W16",
      lastRolloverDate: "2026-04-18",
      lastAutoRunAt: null,
      pendingPromotionCandidates: [],
      promotedCandidateFingerprints: [],
    })

    const runner = new LiveMemorizeTurnRunner({
      db: mockDb([
        { id: "t1", thread_id: "th1", input_text: "q", output_text: "a", completed_at: "2026-04-19T06:00:00.000Z" },
      ]),
      paths,
      store,
      distiller: { distill: async () => { throw new Error("API error") } },
    })

    const result = await runner.run({
      sinceCursor: { "_global": "2026-04-18T06:00:00.000Z" },
      now: new Date(2026, 3, 19, 7, 0),
      trigger: "manual",
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.type).toBe("runner_failed")

    const state = store.read()
    expect(state.lastRunOutcome).toBe("failed")
    expect(state.lastDailyFile).toBe("2026-04-18")
    expect(state.lastProcessedThreadCursor["_global"]).toBe("2026-04-18T06:00:00.000Z")
  })
})
