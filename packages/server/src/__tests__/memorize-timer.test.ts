import { describe, test, expect } from "bun:test"
import {
  memorizeRunNeeded,
  computeNextMemorizeRun,
  computeMostRecentPassedSlot,
} from "../memory/timer.js"

describe("computeMostRecentPassedSlot", () => {
  test("returns today's morning slot when between morning and evening", () => {
    const now = new Date(2026, 3, 19, 12, 0) // noon
    const slot = computeMostRecentPassedSlot(now)
    expect(slot.getHours()).toBe(7)
    expect(slot.getDate()).toBe(19)
  })

  test("returns today's evening slot when after 20:00", () => {
    const now = new Date(2026, 3, 19, 21, 0)
    const slot = computeMostRecentPassedSlot(now)
    expect(slot.getHours()).toBe(20)
    expect(slot.getDate()).toBe(19)
  })

  test("returns yesterday's evening slot when before 07:00", () => {
    const now = new Date(2026, 3, 19, 3, 0)
    const slot = computeMostRecentPassedSlot(now)
    expect(slot.getHours()).toBe(20)
    expect(slot.getDate()).toBe(18)
  })
})

describe("computeNextMemorizeRun", () => {
  test("returns today's morning slot when before 07:00", () => {
    const now = new Date(2026, 3, 19, 6, 0)
    const next = computeNextMemorizeRun(now)
    expect(next.getHours()).toBe(7)
    expect(next.getDate()).toBe(19)
  })

  test("returns today's evening slot when between morning and evening", () => {
    const now = new Date(2026, 3, 19, 12, 0)
    const next = computeNextMemorizeRun(now)
    expect(next.getHours()).toBe(20)
    expect(next.getDate()).toBe(19)
  })

  test("returns tomorrow's morning slot when after 20:00", () => {
    const now = new Date(2026, 3, 19, 21, 0)
    const next = computeNextMemorizeRun(now)
    expect(next.getHours()).toBe(7)
    expect(next.getDate()).toBe(20)
  })
})

describe("memorizeRunNeeded", () => {
  test("returns true when lastRunAt is null", () => {
    expect(memorizeRunNeeded(null, new Date(2026, 3, 19, 12, 0))).toBe(true)
  })

  test("returns true when last run was before the most recent slot", () => {
    const lastRunAt = new Date(2026, 3, 19, 6, 0).toISOString()
    const now = new Date(2026, 3, 19, 12, 0)
    expect(memorizeRunNeeded(lastRunAt, now)).toBe(true)
  })

  test("returns false when last run was after the most recent slot", () => {
    const lastRunAt = new Date(2026, 3, 19, 8, 0).toISOString()
    const now = new Date(2026, 3, 19, 12, 0)
    expect(memorizeRunNeeded(lastRunAt, now)).toBe(false)
  })

  test("returns false when last run was exactly at the most recent slot", () => {
    const lastRunAt = new Date(2026, 3, 19, 7, 0).toISOString()
    const now = new Date(2026, 3, 19, 7, 0)
    expect(memorizeRunNeeded(lastRunAt, now)).toBe(false)
  })
})
