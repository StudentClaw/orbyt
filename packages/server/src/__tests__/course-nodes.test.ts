import { describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { Course } from "@orbyt/contracts"
import { ensureCanvasCourseMemoryNodes } from "../memory/course-nodes.js"
import { createMemoryPaths } from "../memory/paths.js"

function setup() {
  const root = mkdtempSync(join(tmpdir(), "orbyt-course-nodes-"))
  return createMemoryPaths({ env: { ORBYT_HOME: root } })
}

const mythology: Course = {
  id: "canvas-course:19737" as Course["id"],
  name: "Mythology",
  code: "MYTH",
  canvasId: "19737",
  term: "Spring 2026",
}

describe("ensureCanvasCourseMemoryNodes", () => {
  test("creates a missing course memory node", () => {
    const paths = setup()
    const [nodePath] = ensureCanvasCourseMemoryNodes(paths, [mythology], new Date("2026-04-26T00:00:00.000Z"))

    expect(nodePath).toBe(paths.courseIndex("myth"))
    expect(existsSync(paths.courseIndex("myth"))).toBe(true)
    const content = readFileSync(paths.courseIndex("myth"), "utf-8")
    expect(content).toContain("canvasId: 19737")
    expect(content).toContain('canvasName: "Mythology"')
    expect(content).toContain("## Assignment Source Discovery")
  })

  test("updates an existing node matched by canvasId without duplicating by slug", () => {
    const paths = setup()
    mkdirSync(paths.courseDir("old-mythology"), { recursive: true })
    writeFileSync(
      paths.courseIndex("old-mythology"),
      [
        "---",
        "slug: old-mythology",
        "canvasId: 19737",
        "createdAt: \"2026-01-01T00:00:00.000Z\"",
        "---",
        "",
        "# Old Mythology",
        "",
        "## Durable Facts",
        "",
        "- Preserve this user-authored fact.",
      ].join("\n"),
      "utf-8",
    )

    ensureCanvasCourseMemoryNodes(paths, [mythology], new Date("2026-04-26T00:00:00.000Z"))

    expect(existsSync(paths.courseIndex("old-mythology"))).toBe(true)
    expect(existsSync(paths.courseIndex("myth"))).toBe(false)
    const content = readFileSync(paths.courseIndex("old-mythology"), "utf-8")
    expect(content).toContain('canvasName: "Mythology"')
    expect(content).toContain("Preserve this user-authored fact.")
    expect(content).toContain("## Assignment Source Discovery")
  })
})
