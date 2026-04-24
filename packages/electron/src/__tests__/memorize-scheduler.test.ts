import { describe, test, expect } from "bun:test"
import {
  computeNextMemorizeRun,
  computeMostRecentPassedSlot,
  memorizeRunNeeded,
  MemorizeScheduler,
} from "../memorize/memorize-scheduler.js"

function d(hour: number, minute = 0): Date {
  const dt = new Date(2026, 3, 19) // 2026-04-19
  dt.setHours(hour, minute, 0, 0)
  return dt
}

describe("computeNextMemorizeRun", () => {
  test("before 03:00 returns today 03:00", () => {
    const next = computeNextMemorizeRun(d(2, 59))
    expect(next.getHours()).toBe(3)
    expect(next.getMinutes()).toBe(0)
    expect(next.getDate()).toBe(19)
  })

  test("after 03:00 returns tomorrow 03:00", () => {
    const next = computeNextMemorizeRun(d(9, 0))
    expect(next.getHours()).toBe(3)
    expect(next.getDate()).toBe(20)
  })

  test("exactly at 03:00 schedules next day", () => {
    const next = computeNextMemorizeRun(d(3, 0))
    expect(next.getHours()).toBe(3)
    expect(next.getDate()).toBe(20)
  })
})

describe("computeMostRecentPassedSlot", () => {
  test("after 03:00 same day returns today 03:00", () => {
    const slot = computeMostRecentPassedSlot(d(9, 0))
    expect(slot.getHours()).toBe(3)
    expect(slot.getDate()).toBe(19)
  })

  test("before 03:00 returns yesterday 03:00", () => {
    const slot = computeMostRecentPassedSlot(d(2, 30))
    expect(slot.getHours()).toBe(3)
    expect(slot.getDate()).toBe(18)
  })

  test("exactly at 03:00 slot is included as passed", () => {
    const slot = computeMostRecentPassedSlot(d(3, 0))
    expect(slot.getHours()).toBe(3)
    expect(slot.getDate()).toBe(19)
  })
})

describe("memorizeRunNeeded", () => {
  test("always true when no prior run", () => {
    expect(memorizeRunNeeded(null, d(8, 0))).toBe(true)
  })

  test("true when last run predates most recent 03:00", () => {
    const lastRun = d(2, 0)
    const now = d(9, 0)
    expect(memorizeRunNeeded(lastRun, now)).toBe(true)
  })

  test("false when last run is after most recent 03:00", () => {
    const lastRun = d(3, 30)
    const now = d(9, 0)
    expect(memorizeRunNeeded(lastRun, now)).toBe(false)
  })

  test("false when last run is exactly at the slot", () => {
    const lastRun = d(3, 0)
    const now = d(9, 0)
    expect(memorizeRunNeeded(lastRun, now)).toBe(false)
  })

  test("true when graph folder empty even if slot already satisfied", () => {
    const lastRun = d(3, 30)
    const now = d(9, 0)
    expect(memorizeRunNeeded(lastRun, now, true)).toBe(true)
  })
})

describe("MemorizeScheduler", () => {
  test("runCatchUpIfNeeded calls onRun when run is needed", async () => {
    let ran = false
    const scheduler = new MemorizeScheduler({
      getLastRunAt: () => null,
      onRun: async () => { ran = true },
      now: () => d(9, 0),
    })
    await scheduler.runCatchUpIfNeeded()
    expect(ran).toBe(true)
  })

  test("runCatchUpIfNeeded skips when already ran after last slot", async () => {
    let ran = false
    const scheduler = new MemorizeScheduler({
      getLastRunAt: () => d(3, 30),
      onRun: async () => { ran = true },
      now: () => d(9, 0),
    })
    await scheduler.runCatchUpIfNeeded()
    expect(ran).toBe(false)
  })

  test("start schedules a timer and stop clears it", () => {
    const timeouts: number[] = []
    const cleared: number[] = []
    let id = 0

    const scheduler = new MemorizeScheduler({
      getLastRunAt: () => d(3, 30),
      onRun: async () => {},
      now: () => d(9, 0),
      scheduleTimeout: (fn, delay) => {
        timeouts.push(delay)
        return ++id as unknown as ReturnType<typeof setTimeout>
      },
      clearScheduledTimeout: (handle) => {
        cleared.push(handle as unknown as number)
      },
    })

    scheduler.start()
    expect(timeouts.length).toBe(1)
    scheduler.stop()
    expect(cleared.length).toBe(1)
  })
})
