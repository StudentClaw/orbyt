import { describe, test, expect, afterEach } from "bun:test"
import { mkdtempSync, rmSync, readFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createMemoryPaths } from "../memory/paths.js"
import {
  writeDailyFile,
  readDailyFile,
  appendRecapBlock,
} from "../memory/daily-writer.js"

const tempDirs: string[] = []

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "sc-daily-"))
  tempDirs.push(dir)
  const paths = createMemoryPaths({ env: { ORBYT_HOME: dir } })
  mkdirSync(paths.dailyDir, { recursive: true })
  return { paths, dir }
}

afterEach(() => {
  for (const d of tempDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true })
  }
})

describe("writeDailyFile", () => {
  test("creates a new daily file with heading and run block", () => {
    const { paths } = setup()
    const now = new Date(2026, 3, 19, 7, 0)
    writeDailyFile(paths, "### Notable Events\n\n- studied\n", now)
    const content = readFileSync(paths.dailyFile("2026-04-19"), "utf-8")
    expect(content).toContain("# Daily - 2026-04-19")
    expect(content).toContain("## Run 07:00")
    expect(content).toContain("- studied")
  })

  test("appends a second run block to an existing file", () => {
    const { paths } = setup()
    const morning = new Date(2026, 3, 19, 7, 0)
    const evening = new Date(2026, 3, 19, 20, 0)
    writeDailyFile(paths, "### Notable Events\n\n- morning note\n", morning)
    writeDailyFile(paths, "### Notable Events\n\n- evening note\n", evening)
    const content = readFileSync(paths.dailyFile("2026-04-19"), "utf-8")
    expect(content).toContain("## Run 07:00")
    expect(content).toContain("## Run 20:00")
    expect(content).toContain("- morning note")
    expect(content).toContain("- evening note")
    expect(content.indexOf("morning")).toBeLessThan(content.indexOf("evening"))
  })

  test("returns the date key", () => {
    const { paths } = setup()
    const key = writeDailyFile(paths, "output", new Date(2026, 3, 19, 7, 0))
    expect(key).toBe("2026-04-19")
  })
})

describe("appendRecapBlock", () => {
  test("appends a recap block to an existing daily file", () => {
    const { paths } = setup()
    writeDailyFile(paths, "- morning note\n", new Date(2026, 3, 19, 7, 0))
    appendRecapBlock(paths, "2026-04-19", "### Highlights\n\n- shipped feature\n")
    const content = readFileSync(paths.dailyFile("2026-04-19"), "utf-8")
    expect(content).toContain("## End-of-Day Recap")
    expect(content).toContain("- morning note")
    expect(content).toContain("- shipped feature")
    expect(content.indexOf("morning")).toBeLessThan(content.indexOf("shipped"))
  })

  test("creates a new file if the daily file does not exist yet", () => {
    const { paths } = setup()
    appendRecapBlock(paths, "2026-04-19", "### Highlights\n\n- quiet day\n")
    const content = readFileSync(paths.dailyFile("2026-04-19"), "utf-8")
    expect(content).toContain("# Daily - 2026-04-19")
    expect(content).toContain("## End-of-Day Recap")
    expect(content).toContain("- quiet day")
  })

  test("replaces a prior recap block rather than duplicating it", () => {
    const { paths } = setup()
    writeDailyFile(paths, "- morning note\n", new Date(2026, 3, 19, 7, 0))
    appendRecapBlock(paths, "2026-04-19", "first recap")
    appendRecapBlock(paths, "2026-04-19", "second recap")
    const content = readFileSync(paths.dailyFile("2026-04-19"), "utf-8")
    const occurrences = content.split("## End-of-Day Recap").length - 1
    expect(occurrences).toBe(1)
    expect(content).toContain("second recap")
    expect(content).not.toContain("first recap")
  })
})

describe("readDailyFile", () => {
  test("returns null when file does not exist", () => {
    const { paths } = setup()
    expect(readDailyFile(paths, "2026-04-19")).toBeNull()
  })

  test("returns content when file exists", () => {
    const { paths } = setup()
    writeDailyFile(paths, "content here", new Date(2026, 3, 19, 7, 0))
    expect(readDailyFile(paths, "2026-04-19")).toContain("content here")
  })
})
