import { describe, expect, test } from "vitest"
import {
  computeStreak,
  computeCompletionRatio,
  computeWeekOverWeek,
  type ProgressSession,
} from "./progress-model"

function makeSession(
  date: string,
  status: "completed" | "skipped" | "scheduled",
): ProgressSession {
  return {
    id: `s-${date}-${status}`,
    date,
    status,
  }
}

describe("computeStreak", () => {
  test("returns 3 for 3 consecutive completed days", () => {
    const sessions = [
      makeSession("2026-04-07", "completed"),
      makeSession("2026-04-08", "completed"),
      makeSession("2026-04-09", "completed"),
    ]
    const today = new Date("2026-04-09T12:00:00Z")
    expect(computeStreak(sessions, today)).toBe(3)
  })

  test("skips unscheduled days without breaking streak", () => {
    // Completed Mon + Wed, nothing scheduled Tue → streak = 2
    const sessions = [
      makeSession("2026-04-07", "completed"),
      // No session on 2026-04-08
      makeSession("2026-04-09", "completed"),
    ]
    const today = new Date("2026-04-09T12:00:00Z")
    expect(computeStreak(sessions, today)).toBe(2)
  })

  test("resets to 0 when scheduled day has no completion", () => {
    const sessions = [
      makeSession("2026-04-07", "completed"),
      makeSession("2026-04-08", "skipped"),
      makeSession("2026-04-09", "completed"),
    ]
    const today = new Date("2026-04-09T12:00:00Z")
    // Only today's completion counts — streak broke on 4/08
    expect(computeStreak(sessions, today)).toBe(1)
  })

  test("returns 0 when no sessions exist", () => {
    const today = new Date("2026-04-09T12:00:00Z")
    expect(computeStreak([], today)).toBe(0)
  })
})

describe("computeCompletionRatio", () => {
  test("returns correct counts", () => {
    const sessions = [
      makeSession("2026-04-06", "completed"),
      makeSession("2026-04-07", "completed"),
      makeSession("2026-04-08", "skipped"),
      makeSession("2026-04-09", "scheduled"),
    ]
    const result = computeCompletionRatio(sessions, "2026-04-06")
    expect(result.completed).toBe(2)
    expect(result.total).toBe(4)
    expect(result.percentage).toBe(50)
  })

  test("returns 0 for empty sessions", () => {
    const result = computeCompletionRatio([], "2026-04-06")
    expect(result.completed).toBe(0)
    expect(result.total).toBe(0)
    expect(result.percentage).toBe(0)
  })
})

describe("computeWeekOverWeek", () => {
  test("returns 'up' when this week > last week", () => {
    const result = computeWeekOverWeek(
      { completed: 5, total: 7, percentage: 71 },
      { completed: 3, total: 7, percentage: 43 },
    )
    expect(result.direction).toBe("up")
    expect(result.delta).toBeGreaterThan(0)
  })

  test("returns 'down' when this week < last week", () => {
    const result = computeWeekOverWeek(
      { completed: 2, total: 7, percentage: 29 },
      { completed: 5, total: 7, percentage: 71 },
    )
    expect(result.direction).toBe("down")
    expect(result.delta).toBeLessThan(0)
  })

  test("returns 'same' when equal", () => {
    const ratio = { completed: 3, total: 7, percentage: 43 }
    const result = computeWeekOverWeek(ratio, ratio)
    expect(result.direction).toBe("same")
    expect(result.delta).toBe(0)
  })
})
