import { describe, test, expect, afterEach } from "bun:test"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { SQLQueryBindings } from "bun:sqlite"
import { createMemoryPaths } from "../memory/paths.js"
import { markStaleCourseNodes } from "../memory/node-curator.js"
import type { DatabaseService } from "../db/Database.js"

const tempDirs: string[] = []
type QueryParams = Parameters<DatabaseService["query"]>[1]

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "sc-curator-"))
  tempDirs.push(dir)
  const paths = createMemoryPaths({ env: { STUDENT_CLAW_HOME: dir } })
  mkdirSync(paths.coursesDir, { recursive: true })
  return { paths, dir }
}

afterEach(() => {
  for (const d of tempDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true })
  }
})

function mockDb(codes: string[]): DatabaseService {
  return {
    get: <T>(_sql: string, _params?: QueryParams) => null as T | null,
    query: <T>(_sql: string, _params?: QueryParams) =>
      codes.map((code) => ({ code })) as unknown as T[],
    execute: () => {},
    transaction: <T>(fn: () => T) => fn(),
    close: () => {},
  }
}

const COURSE_NODE = `---
slug: cs-301
canvasId: null
canvasName: "cs-301"
courseCode: "CS-301"
term: ""
createdAt: "2026-04-01T00:00:00.000Z"
updatedAt: "2026-04-01T00:00:00.000Z"
---

# cs-301

## Durable Facts

- Some fact
`

const NOW = new Date("2026-04-19T07:00:00.000Z")

function seedCourseNode(paths: ReturnType<typeof createMemoryPaths>, slug: string, content = COURSE_NODE) {
  const dir = join(paths.coursesDir, slug)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "index.md"), content, "utf-8")
}

describe("markStaleCourseNodes", () => {
  test("returns empty array when courses dir does not exist", () => {
    const { paths } = setup()
    rmSync(paths.coursesDir, { recursive: true, force: true })
    const result = markStaleCourseNodes(paths, mockDb(["CS 301"]), NOW)
    expect(result).toEqual([])
  })

  test("returns empty when all course nodes match active courses", () => {
    const { paths } = setup()
    seedCourseNode(paths, "cs-301")
    const result = markStaleCourseNodes(paths, mockDb(["CS 301"]), NOW)
    expect(result).toEqual([])
  })

  test("marks node stale when course is not in active list", () => {
    const { paths } = setup()
    seedCourseNode(paths, "cs-301")
    const result = markStaleCourseNodes(paths, mockDb([]), NOW)
    expect(result).toHaveLength(1)
    expect(result[0]).toContain("cs-301")
  })

  test("adds _stale: true to frontmatter", () => {
    const { paths } = setup()
    seedCourseNode(paths, "cs-301")
    markStaleCourseNodes(paths, mockDb([]), NOW)
    const content = readFileSync(join(paths.coursesDir, "cs-301", "index.md"), "utf-8")
    expect(content).toContain("_stale: true")
  })

  test("adds _staleAt to frontmatter", () => {
    const { paths } = setup()
    seedCourseNode(paths, "cs-301")
    markStaleCourseNodes(paths, mockDb([]), NOW)
    const content = readFileSync(join(paths.coursesDir, "cs-301", "index.md"), "utf-8")
    expect(content).toContain("_staleAt: 2026-04-19T07:00:00.000Z")
  })

  test("updates existing _stale field rather than appending a duplicate", () => {
    const { paths } = setup()
    const alreadyStale = COURSE_NODE.replace(
      "updatedAt: \"2026-04-01T00:00:00.000Z\"",
      "updatedAt: \"2026-04-01T00:00:00.000Z\"\n_stale: false",
    )
    seedCourseNode(paths, "cs-301", alreadyStale)
    markStaleCourseNodes(paths, mockDb([]), NOW)
    const content = readFileSync(join(paths.coursesDir, "cs-301", "index.md"), "utf-8")
    const staleCount = (content.match(/_stale:/g) ?? []).length
    expect(staleCount).toBe(1)
    expect(content).toContain("_stale: true")
  })

  test("skips node that has no frontmatter", () => {
    const { paths } = setup()
    seedCourseNode(paths, "no-frontmatter", "# Just Markdown\n\nNo YAML here.\n")
    const result = markStaleCourseNodes(paths, mockDb([]), NOW)
    expect(result).toHaveLength(0)
  })

  test("normalizes course code to slug for comparison (spaces → dashes)", () => {
    const { paths } = setup()
    seedCourseNode(paths, "cs-301")
    // "CS 301" normalizes to "cs-301" which matches the dir name
    const result = markStaleCourseNodes(paths, mockDb(["CS 301"]), NOW)
    expect(result).toHaveLength(0)
  })

  test("returns multiple stale paths when multiple nodes are inactive", () => {
    const { paths } = setup()
    seedCourseNode(paths, "cs-301")
    seedCourseNode(paths, "eng-101")
    const result = markStaleCourseNodes(paths, mockDb(["MATH 200"]), NOW)
    expect(result).toHaveLength(2)
  })

  test("does not mark a node stale if its dir has no index.md", () => {
    const { paths } = setup()
    mkdirSync(join(paths.coursesDir, "empty-course"), { recursive: true })
    const result = markStaleCourseNodes(paths, mockDb([]), NOW)
    expect(result).toHaveLength(0)
  })
})
