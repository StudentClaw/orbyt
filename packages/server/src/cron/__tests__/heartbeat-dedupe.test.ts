import { describe, test, expect } from "bun:test"
import {
  shouldFireOverdueAt,
  shouldFireForState,
  recordFire,
  type HeartbeatFireState,
} from "../heartbeat-dedupe.js"
import {
  createBunDatabaseService,
  createBunTestDatabase,
  runBunMigrations,
} from "../../__tests__/db-test-helpers.js"

const HOUR = 60 * 60 * 1000

function makeDb() {
  const bun = createBunTestDatabase(":memory:")
  runBunMigrations(bun)
  return createBunDatabaseService(bun)
}

describe("shouldFireForState (non-overdue)", () => {
  test("fires once for due_soon, suppresses subsequent fires", () => {
    const db = makeDb()
    const t0 = Date.parse("2026-04-29T08:00:00Z")
    expect(shouldFireForState(db, "asg-1", "due_soon", t0)).toBe(true)
    recordFire(db, "asg-1", "due_soon", t0)
    expect(shouldFireForState(db, "asg-1", "due_soon", t0 + HOUR)).toBe(false)
    expect(shouldFireForState(db, "asg-1", "due_soon", t0 + 24 * HOUR)).toBe(false)
  })

  test("starting_soon and due_soon are independent states for the same item", () => {
    const db = makeDb()
    const t0 = Date.now()
    recordFire(db, "asg-1", "due_soon", t0)
    expect(shouldFireForState(db, "asg-1", "starting_soon", t0)).toBe(true)
  })

  test("different items don't share state", () => {
    const db = makeDb()
    const t0 = Date.now()
    recordFire(db, "asg-1", "due_soon", t0)
    expect(shouldFireForState(db, "asg-2", "due_soon", t0)).toBe(true)
  })
})

describe("shouldFireOverdueAt (once per day cadence)", () => {
  test("fires the first overdue alert at T+0", () => {
    const db = makeDb()
    const overdueSince = Date.parse("2026-04-29T09:00:00Z")
    expect(shouldFireOverdueAt(db, "asg-1", overdueSince, overdueSince)).toBe(true)
  })

  test("does NOT re-fire within the same day after T+0", () => {
    const db = makeDb()
    const overdueSince = Date.parse("2026-04-29T09:00:00Z")
    recordFire(db, "asg-1", "overdue", overdueSince)
    for (const offset of [HOUR, 2 * HOUR, 5 * HOUR, 8 * HOUR, 12 * HOUR, 23 * HOUR]) {
      expect(
        shouldFireOverdueAt(db, "asg-1", overdueSince, overdueSince + offset),
      ).toBe(false)
    }
  })

  test("fires again at T+24h, then once per 24h thereafter", () => {
    const db = makeDb()
    const overdueSince = Date.parse("2026-04-29T09:00:00Z")
    recordFire(db, "asg-1", "overdue", overdueSince)
    // At +24h → eligible
    expect(
      shouldFireOverdueAt(db, "asg-1", overdueSince, overdueSince + 24 * HOUR),
    ).toBe(true)
    recordFire(db, "asg-1", "overdue", overdueSince + 24 * HOUR)
    // 12h later → not yet
    expect(
      shouldFireOverdueAt(db, "asg-1", overdueSince, overdueSince + 36 * HOUR),
    ).toBe(false)
    // +48h → eligible (next day window)
    expect(
      shouldFireOverdueAt(db, "asg-1", overdueSince, overdueSince + 48 * HOUR),
    ).toBe(true)
  })
})
