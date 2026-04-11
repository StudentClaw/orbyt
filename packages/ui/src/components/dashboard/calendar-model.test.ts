import { describe, expect, test } from "vitest"
import {
  sessionToGridPlacement,
  detectConflicts,
  getWeekDates,
  navigateWeek,
  getSessionsForWeek,
  type CalendarSession,
} from "./calendar-model"

function makeSession(
  id: string,
  startTime: string,
  endTime: string,
  overrides: Partial<CalendarSession> = {},
): CalendarSession {
  return {
    id,
    courseId: "c1",
    courseName: "CS 101",
    title: `Session ${id}`,
    startTime,
    endTime,
    ...overrides,
  }
}

describe("sessionToGridPlacement", () => {
  const weekStart = "2026-04-06" // Monday

  test("maps 9:00-10:30 to correct row and span", () => {
    // Use local time (no Z) so snapToSlot gives predictable local hours
    const session = makeSession("s1", "2026-04-06T09:00:00", "2026-04-06T10:30:00")
    const placement = sessionToGridPlacement(session, weekStart)

    expect(placement.column).toBe(0) // Monday
    expect(placement.rowStart).toBe(36) // 9h * 4 = 36
    expect(placement.rowSpan).toBe(6) // 1.5h * 4 = 6
  })

  test("snaps to 15-min grid", () => {
    // 9:07 should snap to 9:00 (row 36), 10:22 should snap to 10:15 (row 41)
    const session = makeSession("s1", "2026-04-06T09:07:00", "2026-04-06T10:22:00")
    const placement = sessionToGridPlacement(session, weekStart)

    expect(placement.rowStart).toBe(36) // snapped to 9:00
    expect(placement.rowSpan).toBe(5) // snapped: 10:15 - 9:00 = 1h15m = 5 slots
  })

  test("places sessions on correct day column", () => {
    // Wednesday at 2PM local
    const session = makeSession("s1", "2026-04-08T14:00:00", "2026-04-08T15:00:00")
    const placement = sessionToGridPlacement(session, weekStart)

    expect(placement.column).toBe(2) // Wednesday = day index 2
  })
})

describe("detectConflicts", () => {
  test("finds overlapping sessions", () => {
    const sessions = [
      makeSession("s1", "2026-04-06T09:00:00Z", "2026-04-06T10:30:00Z"),
      makeSession("s2", "2026-04-06T10:00:00Z", "2026-04-06T11:00:00Z"),
    ]

    const conflicts = detectConflicts(sessions)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toEqual(["s1", "s2"])
  })

  test("returns empty for non-overlapping sessions", () => {
    const sessions = [
      makeSession("s1", "2026-04-06T09:00:00Z", "2026-04-06T10:00:00Z"),
      makeSession("s2", "2026-04-06T10:00:00Z", "2026-04-06T11:00:00Z"),
    ]

    expect(detectConflicts(sessions)).toHaveLength(0)
  })

  test("returns empty for single session", () => {
    const sessions = [
      makeSession("s1", "2026-04-06T09:00:00Z", "2026-04-06T10:00:00Z"),
    ]

    expect(detectConflicts(sessions)).toHaveLength(0)
  })
})

describe("getWeekDates", () => {
  test("returns 7 ISO date strings starting from weekStart", () => {
    const dates = getWeekDates("2026-04-06")
    expect(dates).toHaveLength(7)
    expect(dates[0]).toBe("2026-04-06")
    expect(dates[6]).toBe("2026-04-12")
  })
})

describe("navigateWeek", () => {
  test("moves forward by 7 days", () => {
    expect(navigateWeek("2026-04-06", "next")).toBe("2026-04-13")
  })

  test("moves backward by 7 days", () => {
    expect(navigateWeek("2026-04-13", "prev")).toBe("2026-04-06")
  })
})

describe("getSessionsForWeek", () => {
  test("filters sessions to those within the week", () => {
    const sessions = [
      makeSession("in-week", "2026-04-07T09:00:00Z", "2026-04-07T10:00:00Z"),
      makeSession("out-of-week", "2026-04-14T09:00:00Z", "2026-04-14T10:00:00Z"),
    ]

    const result = getSessionsForWeek(sessions, "2026-04-06")
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("in-week")
  })

  test("returns empty when no sessions in week", () => {
    const sessions = [
      makeSession("far", "2026-05-01T09:00:00Z", "2026-05-01T10:00:00Z"),
    ]

    expect(getSessionsForWeek(sessions, "2026-04-06")).toHaveLength(0)
  })
})
