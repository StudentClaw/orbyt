import { describe, test, expect } from "bun:test"
import { join } from "node:path"
import {
  createMemoryPaths,
  resolveDefaultMemoryGraphDir,
  resolveMemoryGraphDir,
  resolveMemoryRoot,
} from "../memory/paths.js"

const fakeHome = () => "/home/tester"

describe("resolveMemoryRoot", () => {
  test("defaults to ~/.orbyt/memory when env not set", () => {
    const root = resolveMemoryRoot({ env: {}, home: fakeHome })
    expect(root).toBe("/home/tester/.orbyt/memory")
  })

  test("honors ORBYT_HOME override", () => {
    const root = resolveMemoryRoot({
      env: { ORBYT_HOME: "/tmp/sc-test" },
      home: fakeHome,
    })
    expect(root).toBe("/tmp/sc-test/memory")
  })

  test("honors STUDENT_CLAW_HOME when ORBYT_HOME is unset", () => {
    const root = resolveMemoryRoot({
      env: { STUDENT_CLAW_HOME: "/tmp/legacy-home" },
      home: fakeHome,
    })
    expect(root).toBe("/tmp/legacy-home/memory")
  })

  test("prefers ORBYT_HOME over STUDENT_CLAW_HOME", () => {
    const root = resolveMemoryRoot({
      env: { ORBYT_HOME: "/tmp/new", STUDENT_CLAW_HOME: "/tmp/old" },
      home: fakeHome,
    })
    expect(root).toBe("/tmp/new/memory")
  })

  test("ignores empty ORBYT_HOME", () => {
    const root = resolveMemoryRoot({
      env: { ORBYT_HOME: "   " },
      home: fakeHome,
    })
    expect(root).toBe("/home/tester/.orbyt/memory")
  })
})

describe("resolveMemoryGraphDir", () => {
  test("defaults to a visible Documents folder when no override is set", () => {
    const graphDir = resolveDefaultMemoryGraphDir({ env: {}, home: fakeHome })
    expect(graphDir).toBe("/home/tester/Documents/Orbyt Memory Graph")
  })

  test("uses ORBYT_HOME for the default graph path when provided", () => {
    const graphDir = resolveDefaultMemoryGraphDir({
      env: { ORBYT_HOME: "/tmp/sc-test" },
      home: fakeHome,
    })
    expect(graphDir).toBe("/tmp/sc-test/memory/graph")
  })

  test("honors an explicit graph path override", () => {
    const graphDir = resolveMemoryGraphDir({
      env: {},
      graphDirOverride: "~/Desktop/custom-graph",
      home: fakeHome,
    })
    expect(graphDir).toBe("/home/tester/Desktop/custom-graph")
  })
})

describe("createMemoryPaths", () => {
  const paths = createMemoryPaths({
    env: { ORBYT_HOME: "/tmp/sc" },
    home: fakeHome,
  })

  test("resolves root artifacts", () => {
    expect(paths.root).toBe("/tmp/sc/memory")
    expect(paths.memoryFile).toBe("/tmp/sc/memory/MEMORY.md")
    expect(paths.stateFile).toBe("/tmp/sc/memory/memorize-state.json")
    expect(paths.dailyDir).toBe("/tmp/sc/memory/daily")
    expect(paths.weeklyDir).toBe("/tmp/sc/memory/weekly")
    expect(paths.graphDir).toBe("/tmp/sc/memory/graph")
  })

  test("can point the graph at a separate user-visible folder", () => {
    const customPaths = createMemoryPaths({
      env: {},
      graphDirOverride: "/tmp/student-graph",
      home: fakeHome,
    })
    expect(customPaths.root).toBe("/home/tester/.orbyt/memory")
    expect(customPaths.graphDir).toBe("/tmp/student-graph")
    expect(customPaths.branchIndex("routine")).toBe("/tmp/student-graph/routine/index.md")
  })

  test("resolves scaffold branch index files", () => {
    expect(paths.branchIndex("school")).toBe(
      "/tmp/sc/memory/graph/school/index.md",
    )
    expect(paths.branchIndex("routine")).toBe(
      "/tmp/sc/memory/graph/routine/index.md",
    )
  })

  test("resolves daily files", () => {
    expect(paths.dailyFile("2026-04-19")).toBe(
      "/tmp/sc/memory/daily/2026-04-19.md",
    )
  })

  test("rejects invalid daily date", () => {
    expect(() => paths.dailyFile("2026-4-19")).toThrow()
    expect(() => paths.dailyFile("bad")).toThrow()
  })

  test("resolves weekly files", () => {
    expect(paths.weeklyFile("2026-W16")).toBe(
      "/tmp/sc/memory/weekly/2026-W16.md",
    )
  })

  test("rejects invalid ISO week", () => {
    expect(() => paths.weeklyFile("2026-16")).toThrow()
    expect(() => paths.weeklyFile("2026-w16")).toThrow()
  })

  test("resolves course node paths", () => {
    expect(paths.courseDir("cs-301-data-structures")).toBe(
      join(
        "/tmp/sc/memory/graph/school/courses/cs-301-data-structures",
      ),
    )
    expect(paths.courseIndex("cs-301-data-structures")).toBe(
      join(
        "/tmp/sc/memory/graph/school/courses/cs-301-data-structures/index.md",
      ),
    )
  })

  test("rejects invalid course slug", () => {
    expect(() => paths.courseDir("CS_301")).toThrow()
    expect(() => paths.courseDir("cs 301")).toThrow()
    expect(() => paths.courseDir("-cs301")).toThrow()
  })

  test("resolves playbook files", () => {
    expect(paths.playbookFile("problem-set-playbook")).toBe(
      "/tmp/sc/memory/graph/school/playbooks/problem-set-playbook.md",
    )
  })
})
