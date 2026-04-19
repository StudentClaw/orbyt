import { describe, test, expect } from "bun:test"
import { isoWeekKey, isoDateKey, runLabel } from "../memory/week.js"

describe("isoWeekKey", () => {
  test("first day of 2026", () => {
    expect(isoWeekKey(new Date(2026, 0, 1))).toBe("2026-W01")
  })

  test("2026-04-19 is W16", () => {
    expect(isoWeekKey(new Date(2026, 3, 19))).toBe("2026-W16")
  })

  test("2026-04-12 is W15", () => {
    expect(isoWeekKey(new Date(2026, 3, 12))).toBe("2026-W15")
  })

  test("week boundary: Monday starts new week", () => {
    const sunday = isoWeekKey(new Date(2026, 3, 19))
    const monday = isoWeekKey(new Date(2026, 3, 20))
    expect(monday).not.toBe(sunday)
  })
})

describe("isoDateKey", () => {
  test("pads month and day", () => {
    expect(isoDateKey(new Date(2026, 0, 5))).toBe("2026-01-05")
  })

  test("2026-04-19", () => {
    expect(isoDateKey(new Date(2026, 3, 19))).toBe("2026-04-19")
  })
})

describe("runLabel", () => {
  test("07:00", () => {
    const d = new Date(2026, 3, 19, 7, 0)
    expect(runLabel(d)).toBe("07:00")
  })

  test("20:30", () => {
    const d = new Date(2026, 3, 19, 20, 30)
    expect(runLabel(d)).toBe("20:30")
  })
})
