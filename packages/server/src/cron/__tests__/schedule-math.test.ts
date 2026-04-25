import { describe, test, expect } from "bun:test"
import {
  computeNextCronRunAt,
  computeNextRunAt,
  parseEveryMs,
  previewCronFireTimes,
} from "../schedule-math.js"

describe("parseEveryMs", () => {
  test("parses common shorthand", () => {
    expect(parseEveryMs("30s")).toBe(30_000)
    expect(parseEveryMs("15m")).toBe(15 * 60_000)
    expect(parseEveryMs("2h")).toBe(2 * 60 * 60_000)
  })
  test("rejects junk", () => {
    expect(parseEveryMs("forever")).toBeNull()
    expect(parseEveryMs("0m")).toBeNull()
    expect(parseEveryMs("-5m")).toBeNull()
  })
})

describe("computeNextRunAt", () => {
  test("at is one-shot (returns null)", () => {
    expect(
      computeNextRunAt(
        { scheduleKind: "at", scheduleValue: "now", scheduleTz: null },
        Date.now(),
      ),
    ).toBeNull()
  })

  test("every adds the interval to finish time", () => {
    const finishedAt = 1_000_000
    expect(
      computeNextRunAt(
        { scheduleKind: "every", scheduleValue: "30m", scheduleTz: null },
        finishedAt,
      ),
    ).toBe(finishedAt + 30 * 60_000)
  })

  test("cron fires at the next 8 or 19", () => {
    const at = new Date("2026-04-24T07:00:00Z").getTime()
    const next = computeNextRunAt(
      { scheduleKind: "cron", scheduleValue: "0 8,19 * * *", scheduleTz: "UTC" },
      at,
    )
    expect(next).toBe(new Date("2026-04-24T08:00:00Z").getTime())
  })
})

describe("computeNextCronRunAt", () => {
  test("rolls over to the next slot when current time is past it", () => {
    const at = new Date("2026-04-24T18:30:00Z").getTime()
    const next = computeNextCronRunAt("0 8,19 * * *", "UTC", at)
    expect(next).toBe(new Date("2026-04-24T19:00:00Z").getTime())
  })

  test("rolls to next day after the last slot", () => {
    const at = new Date("2026-04-24T19:30:00Z").getTime()
    const next = computeNextCronRunAt("0 8,19 * * *", "UTC", at)
    expect(next).toBe(new Date("2026-04-25T08:00:00Z").getTime())
  })

  test("returns null on invalid expression", () => {
    expect(computeNextCronRunAt("not a cron", null, Date.now())).toBeNull()
  })
})

describe("previewCronFireTimes", () => {
  test("returns the next N fire times for a valid expression", () => {
    const at = new Date("2026-04-24T07:00:00Z").getTime()
    const result = previewCronFireTimes("0 8,19 * * *", "UTC", 3, at)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fireTimes).toEqual([
      new Date("2026-04-24T08:00:00Z").getTime(),
      new Date("2026-04-24T19:00:00Z").getTime(),
      new Date("2026-04-25T08:00:00Z").getTime(),
    ])
  })

  test("reports a parse error for malformed cron", () => {
    const result = previewCronFireTimes("not-a-cron", null, 3)
    expect(result.ok).toBe(false)
  })
})
