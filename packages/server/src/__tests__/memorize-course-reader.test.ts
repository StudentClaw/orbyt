import { describe, test, expect } from "bun:test"
import { readCourseContext } from "../memory/course-reader.js"
import type { DatabaseService } from "../db/Database.js"
import type { SQLQueryBindings } from "bun:sqlite"

type CourseRow = { id: string; name: string; code: string }

function mockDb(rows: CourseRow[]): DatabaseService {
  return {
    db: {} as never,
    get: () => null,
    query: <T>(_sql: string, _params?: SQLQueryBindings[]) => rows as unknown as T[],
    execute: () => {},
    transaction: <T>(fn: () => T) => fn(),
    close: () => {},
  }
}

describe("readCourseContext", () => {
  test("returns _none yet_ when no courses", () => {
    const result = readCourseContext(mockDb([]))
    expect(result).toBe("_none yet_")
  })

  test("formats a single course as code: name", () => {
    const result = readCourseContext(mockDb([
      { id: "1", name: "Introduction to CS", code: "CS 101" },
    ]))
    expect(result).toBe("- CS 101: Introduction to CS")
  })

  test("formats multiple courses as bullet list", () => {
    const result = readCourseContext(mockDb([
      { id: "1", name: "Data Structures", code: "CS 201" },
      { id: "2", name: "Writing 101", code: "ENG 101" },
    ]))
    expect(result).toBe("- CS 201: Data Structures\n- ENG 101: Writing 101")
  })
})
