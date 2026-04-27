import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildMemoryContext } from "../skills/MemoryContextBuilder.js"
import { createBunDatabaseService, createBunTestDatabase, runBunMigrations } from "./db-test-helpers.js"

describe("MemoryContextBuilder", () => {
  test("surfaces durable markdown graph memory from the configured graph path", () => {
    const db = createBunTestDatabase(":memory:")
    runBunMigrations(db)
    const database = createBunDatabaseService(db)
    const dir = mkdtempSync(join(tmpdir(), "orbyt-memory-context-"))

    try {
      const courseDir = join(dir, "school", "courses", "mythology")
      mkdirSync(courseDir, { recursive: true })
      writeFileSync(
        join(courseDir, "index.md"),
        [
          "# mythology",
          "",
          "## Assignment Source Rules",
          "",
          "```json",
          "{",
          '  "kind": "canvas_page",',
          '  "url": "https://ivc-new.instructure.com/courses/19737/wiki"',
          "}",
          "```",
        ].join("\n"),
        "utf8",
      )
      database.execute(
        `INSERT OR IGNORE INTO user_preferences
           (id, study_times, course_ranking, max_session_mins, off_limit_days,
            notification_enabled, quiet_hours_start, quiet_hours_end, calendar_integration,
            memory_graph_path, default_access_mode)
         VALUES (1, '[]', '[]', 90, '[]', 1, '22:00', '08:00', 'none', NULL, 'default')`,
      )
      database.execute("UPDATE user_preferences SET memory_graph_path = ? WHERE id = 1", [dir])

      const context = buildMemoryContext(database)

      expect(context).toContain("[Memory Context]")
      expect(context).toContain(`Durable memory graph: ${dir}`)
      expect(context).toContain("school/courses/mythology/index.md")
      expect(context).toContain("https://ivc-new.instructure.com/courses/19737/wiki")
    } finally {
      database.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
