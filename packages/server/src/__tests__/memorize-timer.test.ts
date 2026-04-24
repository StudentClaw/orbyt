import { describe, test, expect } from "bun:test"
import {
  memorizeRunNeeded,
  computeNextMemorizeRun,
  computeMostRecentPassedSlot,
} from "../memory/timer.js"

describe("computeMostRecentPassedSlot (3 AM fallback)", () => {
  test("returns today 03:00 when later in the day", () => {
    const now = new Date(2026, 3, 19, 12, 0)
    const slot = computeMostRecentPassedSlot(now)
    expect(slot.getHours()).toBe(3)
    expect(slot.getDate()).toBe(19)
  })

  test("returns yesterday 03:00 when before 03:00 today", () => {
    const now = new Date(2026, 3, 19, 2, 0)
    const slot = computeMostRecentPassedSlot(now)
    expect(slot.getHours()).toBe(3)
    expect(slot.getDate()).toBe(18)
  })

  test("exactly at 03:00 is included as passed", () => {
    const now = new Date(2026, 3, 19, 3, 0)
    const slot = computeMostRecentPassedSlot(now)
    expect(slot.getHours()).toBe(3)
    expect(slot.getDate()).toBe(19)
  })
})

describe("computeNextMemorizeRun (3 AM fallback)", () => {
  test("returns today 03:00 when before 03:00", () => {
    const now = new Date(2026, 3, 19, 2, 0)
    const next = computeNextMemorizeRun(now)
    expect(next.getHours()).toBe(3)
    expect(next.getDate()).toBe(19)
  })

  test("returns tomorrow 03:00 when after 03:00", () => {
    const now = new Date(2026, 3, 19, 12, 0)
    const next = computeNextMemorizeRun(now)
    expect(next.getHours()).toBe(3)
    expect(next.getDate()).toBe(20)
  })
})

describe("memorizeRunNeeded", () => {
  test("returns true when lastRunAt is null", () => {
    expect(memorizeRunNeeded(null, new Date(2026, 3, 19, 12, 0))).toBe(true)
  })

  test("returns true when last run was before today's 03:00", () => {
    const lastRunAt = new Date(2026, 3, 19, 2, 30).toISOString()
    const now = new Date(2026, 3, 19, 12, 0)
    expect(memorizeRunNeeded(lastRunAt, now)).toBe(true)
  })

  test("returns false when last run was after today's 03:00", () => {
    const lastRunAt = new Date(2026, 3, 19, 8, 0).toISOString()
    const now = new Date(2026, 3, 19, 12, 0)
    expect(memorizeRunNeeded(lastRunAt, now)).toBe(false)
  })

  test("returns true when the graph folder is empty even if the slot is already satisfied", () => {
    const lastRunAt = new Date(2026, 3, 19, 8, 0).toISOString()
    const now = new Date(2026, 3, 19, 12, 0)
    expect(memorizeRunNeeded(lastRunAt, now, true)).toBe(true)
  })
})
