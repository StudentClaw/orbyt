import { describe, test, expect, afterEach } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createMemoryPaths } from "../memory/paths.js"
import { enforceRetention, listDailyKeys, listWeeklyKeys } from "../memory/pruner.js"
import type { MemorizeDistiller } from "../memory/distiller.js"

const tempDirs: string[] = []

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "sc-pruner-"))
  tempDirs.push(dir)
  const paths = createMemoryPaths({ env: { ORBYT_HOME: dir } })
  mkdirSync(paths.dailyDir, { recursive: true })
  mkdirSync(paths.weeklyDir, { recursive: true })
  return { paths, dir }
}

function mockDistiller(output = "distilled"): MemorizeDistiller {
  return { distill: async () => output }
}

function seedDaily(paths: ReturnType<typeof createMemoryPaths>, dateKeys: string[]) {
  for (const key of dateKeys) {
    writeFileSync(join(paths.dailyDir, `${key}.md`), `# Daily - ${key}\n\n## Run 07:00\n\n- note\n`, "utf-8")
  }
}

function seedWeekly(paths: ReturnType<typeof createMemoryPaths>, weekKeys: string[]) {
  for (const key of weekKeys) {
    writeFileSync(join(paths.weeklyDir, `${key}.md`), `# Weekly - ${key}\n\ncontent\n`, "utf-8")
  }
}

afterEach(() => {
  for (const d of tempDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true })
  }
})

describe("listDailyKeys / listWeeklyKeys", () => {
  test("returns empty array when dir is empty", () => {
    const { paths } = setup()
    expect(listDailyKeys(paths)).toEqual([])
    expect(listWeeklyKeys(paths)).toEqual([])
  })

  test("returns sorted keys", () => {
    const { paths } = setup()
    seedDaily(paths, ["2026-04-17", "2026-04-15", "2026-04-19"])
    expect(listDailyKeys(paths)).toEqual([
      "2026-04-15",
      "2026-04-17",
      "2026-04-19",
    ])
  })
})

describe("enforceRetention — daily", () => {
  test("leaves 7 files unchanged", async () => {
    const { paths } = setup()
    const keys = Array.from({ length: 7 }, (_, i) => `2026-04-${String(i + 13).padStart(2, "0")}`)
    seedDaily(paths, keys)
    const { prunedDaily } = await enforceRetention(paths, mockDistiller())
    expect(prunedDaily).toEqual([])
    expect(listDailyKeys(paths)).toHaveLength(7)
  })

  test("prunes oldest when 8 daily files exist", async () => {
    const { paths } = setup()
    const keys = Array.from({ length: 8 }, (_, i) => `2026-04-${String(i + 12).padStart(2, "0")}`)
    seedDaily(paths, keys)
    const { prunedDaily } = await enforceRetention(paths, mockDistiller())
    expect(prunedDaily).toEqual(["2026-04-12"])
    expect(listDailyKeys(paths)).toHaveLength(7)
    expect(existsSync(join(paths.dailyDir, "2026-04-12.md"))).toBe(false)
  })

  test("distills expiring daily into its ISO week's weekly file", async () => {
    const { paths } = setup()
    const keys = Array.from({ length: 8 }, (_, i) => `2026-04-${String(i + 12).padStart(2, "0")}`)
    seedDaily(paths, keys)
    await enforceRetention(paths, mockDistiller("## Recurring Struggles\n\n- none\n"))
    // 2026-04-12 is a Sunday in W15
    expect(existsSync(join(paths.weeklyDir, "2026-W15.md"))).toBe(true)
  })

  test("prunes two when 9 files exist", async () => {
    const { paths } = setup()
    const keys = Array.from({ length: 9 }, (_, i) => `2026-04-${String(i + 11).padStart(2, "0")}`)
    seedDaily(paths, keys)
    const { prunedDaily } = await enforceRetention(paths, mockDistiller())
    expect(prunedDaily).toHaveLength(2)
    expect(listDailyKeys(paths)).toHaveLength(7)
  })
})

describe("enforceRetention — weekly", () => {
  test("leaves 4 weekly files unchanged", async () => {
    const { paths } = setup()
    seedWeekly(paths, ["2026-W13", "2026-W14", "2026-W15", "2026-W16"])
    const { prunedWeekly } = await enforceRetention(paths, mockDistiller())
    expect(prunedWeekly).toEqual([])
    expect(listWeeklyKeys(paths)).toHaveLength(4)
  })

  test("prunes oldest weekly when 5 exist", async () => {
    const { paths } = setup()
    seedWeekly(paths, ["2026-W12", "2026-W13", "2026-W14", "2026-W15", "2026-W16"])
    const { prunedWeekly } = await enforceRetention(paths, mockDistiller())
    expect(prunedWeekly).toEqual(["2026-W12"])
    expect(listWeeklyKeys(paths)).toHaveLength(4)
    expect(existsSync(join(paths.weeklyDir, "2026-W12.md"))).toBe(false)
  })
})
