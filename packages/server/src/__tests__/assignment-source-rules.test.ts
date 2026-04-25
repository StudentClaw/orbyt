import { describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { Database as BunDatabase } from "bun:sqlite"
import {
  parseAssignmentSourceRulesFromMarkdown,
  projectAssignmentSourceRules,
} from "../memory/assignment-source-rules.js"
import { createMemoryPaths } from "../memory/paths.js"
import { createBunDatabaseService, runBunMigrations } from "./db-test-helpers.js"

describe("assignment source rules", () => {
  test("parses enabled JSON rules from the course graph section", () => {
    const markdown = [
      "---",
      "slug: mythology",
      "canvasId: 19737",
      "---",
      "",
      "# Mythology",
      "",
      "## Assignment Source Rules",
      "",
      "```json",
      JSON.stringify({
        kind: "canvas_page",
        url: "https://ivc-new.instructure.com/courses/19737/wiki",
        purpose: "reading_homework_schedule",
        parser: "dated_reading_schedule",
        enabled: true,
      }, null, 2),
      "```",
      "",
      "## Durable Facts",
      "",
      "_none yet_",
    ].join("\n")

    const rules = parseAssignmentSourceRulesFromMarkdown(
      markdown,
      "/memory/graph/school/courses/mythology/index.md",
      "mythology",
    )

    expect(rules).toEqual([
      expect.objectContaining({
        kind: "canvas_page",
        canvasCourseId: "19737",
        url: "https://ivc-new.instructure.com/courses/19737/wiki",
        parser: "dated_reading_schedule",
        enabled: true,
      }),
    ])
  })

  test("projects graph rules into SQLite with local course matching", () => {
    const root = mkdtempSync(join(tmpdir(), "orbyt-assignment-source-"))
    const paths = createMemoryPaths({ env: { ORBYT_HOME: root } })
    const courseDir = paths.courseDir("mythology")
    mkdirSync(courseDir, { recursive: true })
    writeFileSync(
      paths.courseIndex("mythology"),
      [
        "---",
        "slug: mythology",
        "canvasId: 19737",
        "---",
        "",
        "# Mythology",
        "",
        "## Assignment Source Rules",
        "",
        "```json",
        JSON.stringify({
          kind: "canvas_page",
          canvasCourseId: "19737",
          url: "https://ivc-new.instructure.com/courses/19737/wiki",
          purpose: "reading_homework_schedule",
          parser: "dated_reading_schedule",
          enabled: true,
        }, null, 2),
        "```",
      ].join("\n"),
      "utf-8",
    )

    const db = new BunDatabase(":memory:")
    runBunMigrations(db)
    const database = createBunDatabaseService(db)
    database.execute(
      "INSERT INTO courses (id, name, code, canvas_id) VALUES (?, ?, ?, ?)",
      ["canvas-course:19737", "Mythology", "MYTH", "19737"],
    )

    projectAssignmentSourceRules(database, paths)

    expect(database.query("SELECT * FROM course_assignment_sources")).toEqual([
      expect.objectContaining({
        local_course_id: "canvas-course:19737",
        canvas_course_id: "19737",
        enabled: 1,
        parser: "dated_reading_schedule",
      }),
    ])

    database.close()
  })

  test("matches a remembered course slug to a Canvas course name with section suffix", () => {
    const root = mkdtempSync(join(tmpdir(), "orbyt-assignment-source-fuzzy-"))
    const paths = createMemoryPaths({ env: { ORBYT_HOME: root } })
    mkdirSync(paths.courseDir("mythology"), { recursive: true })
    writeFileSync(
      paths.courseIndex("mythology"),
      [
        "# Mythology",
        "",
        "## Assignment Source Rules",
        "",
        "```json",
        JSON.stringify({
          kind: "canvas_page",
          canvasCourseId: "19737",
          url: "https://ivc-new.instructure.com/courses/19737/wiki",
          purpose: "reading_homework_schedule",
          parser: "dated_reading_schedule",
          enabled: true,
        }, null, 2),
        "```",
      ].join("\n"),
      "utf-8",
    )

    const db = new BunDatabase(":memory:")
    runBunMigrations(db)
    const database = createBunDatabaseService(db)
    database.execute(
      "INSERT INTO courses (id, name, code, canvas_id) VALUES (?, ?, ?, ?)",
      ["canvas-course:19737", "Mythology - 30752", "202630_HUM50_30752", null],
    )

    projectAssignmentSourceRules(database, paths)

    expect(database.query("SELECT local_course_id, canvas_course_id FROM course_assignment_sources")).toEqual([
      {
        local_course_id: "canvas-course:19737",
        canvas_course_id: "19737",
      },
    ])

    database.close()
  })
})
