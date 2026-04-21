import { describe, test, expect, afterEach } from "bun:test"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { SQLQueryBindings } from "bun:sqlite"
import { createMemoryPaths } from "../memory/paths.js"
import { MemorizeStateStore } from "../memory/state-store.js"
import { LiveMemorizeTurnRunner } from "../memory/live-runner.js"
import type { MemorizeDistiller } from "../memory/distiller.js"
import type { DatabaseService } from "../db/Database.js"

const tempDirs: string[] = []

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "sc-recovery-"))
  tempDirs.push(dir)
  const paths = createMemoryPaths({ env: { STUDENT_CLAW_HOME: dir } })
  mkdirSync(paths.root, { recursive: true })
  const store = new MemorizeStateStore(paths)
  return { paths, store, dir }
}

afterEach(() => {
  for (const d of tempDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true })
  }
})

function mockDb(): DatabaseService {
  return {
    db: {} as never,
    get: () => null,
    query: <T>(_sql: string, _params?: SQLQueryBindings[]) => [] as unknown as T[],
    execute: () => {},
    transaction: <T>(fn: () => T) => fn(),
    close: () => {},
  }
}

function trackingDistiller(): MemorizeDistiller & { callCount: number } {
  const d = {
    callCount: 0,
    distill: async (_prompt: string) => {
      d.callCount += 1
      return "### Notable Events\n\n- studied\n"
    },
  }
  return d
}

const NOW = new Date(2026, 3, 19, 7, 0)
const DATE_KEY = "2026-04-19"

describe("LiveMemorizeTurnRunner — recovery path", () => {
  test("skips distillation when daily file already exists for today", async () => {
    const { paths, store } = setup()
    mkdirSync(paths.dailyDir, { recursive: true })

    // Simulate a previous run that wrote the daily file but failed before commitSuccess
    writeFileSync(
      paths.dailyFile(DATE_KEY),
      `# Daily - ${DATE_KEY}\n\n## Run 07:00\n\n- previous distillation\n`,
      "utf-8",
    )

    const distiller = trackingDistiller()
    const runner = new LiveMemorizeTurnRunner({
      db: mockDb(),
      paths,
      store,
      distiller,
    })

    const result = await runner.run({ sinceCursor: {}, now: NOW })

    expect(result.ok).toBe(true)
    expect(distiller.callCount).toBe(0)
  })

  test("reports daily file as written in recovery mode", async () => {
    const { paths, store } = setup()
    mkdirSync(paths.dailyDir, { recursive: true })

    writeFileSync(
      paths.dailyFile(DATE_KEY),
      `# Daily - ${DATE_KEY}\n\n## Run 07:00\n\n- previous\n`,
      "utf-8",
    )

    const runner = new LiveMemorizeTurnRunner({
      db: mockDb(),
      paths,
      store,
      distiller: trackingDistiller(),
    })

    const result = await runner.run({ sinceCursor: {}, now: NOW })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.dailyFileWritten).toBe(DATE_KEY)
  })

  test("commits success in recovery mode and leaves existing file intact", async () => {
    const { paths, store } = setup()
    mkdirSync(paths.dailyDir, { recursive: true })

    const originalContent = `# Daily - ${DATE_KEY}\n\n## Run 07:00\n\n- previous\n`
    writeFileSync(paths.dailyFile(DATE_KEY), originalContent, "utf-8")

    const runner = new LiveMemorizeTurnRunner({
      db: mockDb(),
      paths,
      store,
      distiller: trackingDistiller(),
    })

    await runner.run({ sinceCursor: {}, now: NOW })

    expect(store.read().lastRunOutcome).toBe("success")
    expect(readFileSync(paths.dailyFile(DATE_KEY), "utf-8")).toBe(originalContent)
  })

  test("writes error log when distillation throws", async () => {
    const { paths, store } = setup()
    mkdirSync(paths.dailyDir, { recursive: true })
    mkdirSync(paths.weeklyDir, { recursive: true })

    const failingDistiller: MemorizeDistiller = {
      distill: async () => {
        throw new Error("API quota exceeded")
      },
    }

    const db: DatabaseService = {
      db: {} as never,
      get: () => null,
      query: <T>(_sql: string, _params?: SQLQueryBindings[]) =>
        [{ id: "t1", thread_id: "th1", input_text: "q", output_text: "a", completed_at: "2026-04-19T06:00:00.000Z" }] as unknown as T[],
      execute: () => {},
      transaction: <T>(fn: () => T) => fn(),
      close: () => {},
    }

    const runner = new LiveMemorizeTurnRunner({ db, paths, store, distiller: failingDistiller })
    const result = await runner.run({ sinceCursor: {}, now: NOW })

    expect(result.ok).toBe(false)
    expect(existsSync(paths.errorLog)).toBe(true)
    const log = readFileSync(paths.errorLog, "utf-8")
    expect(log).toContain("API quota exceeded")
    expect(log).toContain("live-runner.run")
  })
})
