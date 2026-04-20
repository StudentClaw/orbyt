import { describe, test, expect, afterEach } from "bun:test"
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createMemoryPaths } from "../memory/paths.js"
import { writeGraphCandidate } from "../memory/graph-writer.js"
import { candidateFingerprint } from "../memory/candidate-parser.js"

const tempDirs: string[] = []

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "sc-graph-writer-"))
  tempDirs.push(dir)
  const paths = createMemoryPaths({ env: { STUDENT_CLAW_HOME: dir } })
  mkdirSync(paths.root, { recursive: true })
  return { paths }
}

afterEach(() => {
  for (const d of tempDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true })
  }
})

function candidate(text: string, branch: string) {
  return {
    id: "cand_test",
    fingerprint: candidateFingerprint(text),
    source: "daily" as const,
    branch,
    text,
    confidence: 0.8,
    firstSeenAt: "2026-04-19T00:00:00.000Z",
    lastSeenAt: "2026-04-19T00:00:00.000Z",
    evidenceCount: 2,
  }
}

const NOW = new Date("2026-04-19T07:00:00.000Z")

describe("writeGraphCandidate — scaffold branches", () => {
  test("creates new file for scaffold branch", () => {
    const { paths } = setup()
    writeGraphCandidate(paths, candidate("I study best in the morning", "personality"), NOW)
    expect(existsSync(paths.branchIndex("personality"))).toBe(true)
  })

  test("new scaffold node contains Durable Facts heading and bullet", () => {
    const { paths } = setup()
    writeGraphCandidate(paths, candidate("I prefer async communication", "personality"), NOW)
    const content = readFileSync(paths.branchIndex("personality"), "utf-8")
    expect(content).toContain("## Durable Facts")
    expect(content).toContain("I prefer async communication")
  })

  test("appends second fact to existing scaffold node", () => {
    const { paths } = setup()
    writeGraphCandidate(paths, candidate("First fact", "school"), NOW)
    writeGraphCandidate(paths, candidate("Second fact", "school"), NOW)
    const content = readFileSync(paths.branchIndex("school"), "utf-8")
    expect(content).toContain("First fact")
    expect(content).toContain("Second fact")
  })

  test("bullet includes promotion date", () => {
    const { paths } = setup()
    writeGraphCandidate(paths, candidate("A fact", "routine"), NOW)
    const content = readFileSync(paths.branchIndex("routine"), "utf-8")
    expect(content).toContain("_(promoted 2026-04-19)_")
  })
})

describe("writeGraphCandidate — course branches", () => {
  test("creates course file with YAML frontmatter", () => {
    const { paths } = setup()
    writeGraphCandidate(paths, candidate("Canvas tab used for grades", "school/courses/cs-301"), NOW)
    const content = readFileSync(paths.courseIndex("cs-301"), "utf-8")
    expect(content).toContain("slug: cs-301")
    expect(content).toContain("canvasId: null")
  })

  test("routes canvas/module keyword to Canvas Layout section", () => {
    const { paths } = setup()
    writeGraphCandidate(paths, candidate("Navigation tab links to modules", "school/courses/eng-101"), NOW)
    const content = readFileSync(paths.courseIndex("eng-101"), "utf-8")
    const canvasIdx = content.indexOf("## Canvas Layout")
    const factIdx = content.indexOf("Navigation tab links to modules")
    expect(factIdx).toBeGreaterThan(canvasIdx)
  })

  test("routes professor keyword to Professor Patterns section", () => {
    const { paths } = setup()
    writeGraphCandidate(paths, candidate("Professor posts grades within 48h", "school/courses/cs-301"), NOW)
    const content = readFileSync(paths.courseIndex("cs-301"), "utf-8")
    const profIdx = content.indexOf("## Professor Patterns")
    const factIdx = content.indexOf("Professor posts grades within 48h")
    expect(factIdx).toBeGreaterThan(profIdx)
  })

  test("routes avoid/pitfall keyword to Recurring Pitfalls section", () => {
    const { paths } = setup()
    writeGraphCandidate(paths, candidate("Avoid starting tasks the night before", "school/courses/cs-301"), NOW)
    const content = readFileSync(paths.courseIndex("cs-301"), "utf-8")
    const pitfallIdx = content.indexOf("## Recurring Pitfalls")
    const factIdx = content.indexOf("Avoid starting tasks the night before")
    expect(factIdx).toBeGreaterThan(pitfallIdx)
  })

  test("routes assignment keyword to Assignment Strategy section", () => {
    const { paths } = setup()
    writeGraphCandidate(paths, candidate("Homework is graded on completeness", "school/courses/cs-301"), NOW)
    const content = readFileSync(paths.courseIndex("cs-301"), "utf-8")
    const assignIdx = content.indexOf("## Assignment Strategy")
    const factIdx = content.indexOf("Homework is graded on completeness")
    expect(factIdx).toBeGreaterThan(assignIdx)
  })

  test("unmatched text routes to Durable Facts", () => {
    const { paths } = setup()
    writeGraphCandidate(paths, candidate("The course has 3 units", "school/courses/cs-301"), NOW)
    const content = readFileSync(paths.courseIndex("cs-301"), "utf-8")
    const durableIdx = content.indexOf("## Durable Facts")
    const factIdx = content.indexOf("The course has 3 units")
    expect(factIdx).toBeGreaterThan(durableIdx)
  })
})

describe("writeGraphCandidate — playbook branches", () => {
  test("creates playbook file", () => {
    const { paths } = setup()
    writeGraphCandidate(paths, candidate("Read the prompt twice before writing", "school/playbooks/essays"), NOW)
    expect(existsSync(paths.playbookFile("essays"))).toBe(true)
  })
})

describe("writeGraphCandidate — return value", () => {
  test("returns the file path that was written", () => {
    const { paths } = setup()
    const filePath = writeGraphCandidate(paths, candidate("A fact", "school"), NOW)
    expect(filePath).toBe(paths.branchIndex("school"))
  })

  test("returned path exists after write", () => {
    const { paths } = setup()
    const filePath = writeGraphCandidate(paths, candidate("A fact", "personality"), NOW)
    expect(existsSync(filePath)).toBe(true)
  })
})
