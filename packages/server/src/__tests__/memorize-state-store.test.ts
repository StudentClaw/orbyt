import { describe, test, expect, afterEach } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { initialMemorizeState } from "@student-claw/contracts"
import { createMemoryPaths } from "../memory/paths.js"
import { MemorizeStateStore } from "../memory/state-store.js"

const tempDirs: string[] = []

function setup(): { store: MemorizeStateStore; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "sc-memorize-state-"))
  tempDirs.push(dir)
  const paths = createMemoryPaths({ env: { STUDENT_CLAW_HOME: dir } })
  const store = new MemorizeStateStore(paths)
  return { store, dir }
}

afterEach(() => {
  for (const d of tempDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true })
  }
})

describe("MemorizeStateStore.read", () => {
  test("returns initial state when file does not exist", () => {
    const { store } = setup()
    const state = store.read()
    expect(state).toEqual(initialMemorizeState())
  })

  test("reads and validates existing state", () => {
    const { store, dir } = setup()
    const saved = {
      ...initialMemorizeState(),
      lastRunAt: "2026-04-19T07:00:00.000Z",
      lastRunOutcome: "success" as const,
      lastDailyFile: "2026-04-19",
      lastWeeklyFile: "2026-W16",
    }
    const memDir = join(dir, "memory")
    mkdirSync(memDir, { recursive: true })
    writeFileSync(join(memDir, "memorize-state.json"), JSON.stringify(saved), "utf-8")
    const state = store.read()
    expect(state.lastRunAt).toBe("2026-04-19T07:00:00.000Z")
    expect(state.lastDailyFile).toBe("2026-04-19")
  })

  test("throws on invalid state shape", () => {
    const { store, dir } = setup()
    const memDir = join(dir, "memory")
    mkdirSync(memDir, { recursive: true })
    writeFileSync(join(memDir, "memorize-state.json"), JSON.stringify({ version: 999 }), "utf-8")
    expect(() => store.read()).toThrow()
  })
})

describe("MemorizeStateStore.write", () => {
  test("creates the state file atomically", () => {
    const { store, dir } = setup()
    const state = {
      ...initialMemorizeState(),
      lastRunAt: "2026-04-19T07:00:00.000Z",
    }
    store.write(state)
    const stateFile = join(dir, "memory", "memorize-state.json")
    expect(existsSync(stateFile)).toBe(true)
    const roundtrip = store.read()
    expect(roundtrip.lastRunAt).toBe("2026-04-19T07:00:00.000Z")
  })

  test("no temp file left after successful write", () => {
    const { store, dir } = setup()
    store.write(initialMemorizeState())
    const tmp = join(dir, "memory", ".memorize-state.tmp.json")
    expect(existsSync(tmp)).toBe(false)
  })
})

describe("MemorizeStateStore.commitSuccess", () => {
  test("updates run fields and sets outcome to success", () => {
    const { store } = setup()
    store.commitSuccess({
      lastRunAt: "2026-04-19T07:00:00.000Z",
      lastProcessedThreadCursor: { thread1: "2026-04-19T06:59:00.000Z" },
      lastDailyFile: "2026-04-19",
      lastWeeklyFile: "2026-W16",
      pendingPromotionCandidates: [],
    })
    const state = store.read()
    expect(state.lastRunOutcome).toBe("success")
    expect(state.lastDailyFile).toBe("2026-04-19")
    expect(state.lastProcessedThreadCursor).toEqual({
      thread1: "2026-04-19T06:59:00.000Z",
    })
  })
})

describe("MemorizeStateStore.recordFailure", () => {
  test("sets outcome to failed without losing other checkpoint fields", () => {
    const { store } = setup()
    store.commitSuccess({
      lastRunAt: "2026-04-19T07:00:00.000Z",
      lastProcessedThreadCursor: {},
      lastDailyFile: "2026-04-19",
      lastWeeklyFile: "2026-W16",
      pendingPromotionCandidates: [],
    })
    store.recordFailure()
    const state = store.read()
    expect(state.lastRunOutcome).toBe("failed")
    expect(state.lastDailyFile).toBe("2026-04-19")
  })
})
