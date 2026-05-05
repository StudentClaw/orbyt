import { describe, test, expect } from "bun:test"
import { selectHeartbeatCandidates } from "../heartbeat-candidates.js"
import {
  createBunDatabaseService,
  createBunTestDatabase,
  runBunMigrations,
} from "../../__tests__/db-test-helpers.js"
import { recordFire } from "../heartbeat-dedupe.js"
import type { UpcomingCourseworkRecord } from "../insight-context.js"

const MIN = 60 * 1000
const HOUR = 60 * MIN

function makeDb() {
  const bun = createBunTestDatabase(":memory:")
  runBunMigrations(bun)
  return createBunDatabaseService(bun)
}

function item(
  overrides: Partial<UpcomingCourseworkRecord> & {
    readonly itemId: string
    readonly dueAt: string
  },
): UpcomingCourseworkRecord {
  return {
    course: "TEST101",
    title: "Untitled",
    assignmentType: "work",
    htmlUrl: null,
    ...overrides,
  }
}

describe("selectHeartbeatCandidates", () => {
  test("imminent (<= 30 min) work item produces instant_imminent", () => {
    const db = makeDb()
    const now = new Date("2026-04-29T12:00:00Z")
    const dueAt = new Date(now.getTime() + 20 * MIN).toISOString()
    const got = selectHeartbeatCandidates(
      db,
      [item({ itemId: "a", title: "HW 1", dueAt })],
      now,
    )
    expect(got).toHaveLength(1)
    expect(got[0]?.kind).toBe("instant_imminent")
    expect(got[0]?.title).toBe("HW 1")
  })

  test("4-hour-out work item produces schedule_later at T-2h", () => {
    const db = makeDb()
    const now = new Date("2026-04-29T12:00:00Z")
    const dueAt = new Date(now.getTime() + 4 * HOUR).toISOString()
    const got = selectHeartbeatCandidates(
      db,
      [item({ itemId: "a", title: "HW 1", dueAt })],
      now,
    )
    expect(got).toHaveLength(1)
    expect(got[0]?.kind).toBe("schedule_later")
    // 4h - 2h = 2h out from now
    expect(got[0]?.scheduleAtIso).toBe(
      new Date(now.getTime() + 2 * HOUR).toISOString(),
    )
  })

  test("4-hour-out assessment item produces schedule_later at T-15min", () => {
    const db = makeDb()
    const now = new Date("2026-04-29T12:00:00Z")
    const dueAt = new Date(now.getTime() + 4 * HOUR).toISOString()
    const got = selectHeartbeatCandidates(
      db,
      [item({ itemId: "a", title: "Quiz 4", dueAt, assignmentType: "assessment" })],
      now,
    )
    expect(got).toHaveLength(1)
    expect(got[0]?.kind).toBe("schedule_later")
    expect(got[0]?.scheduleAtIso).toBe(
      new Date(now.getTime() + 4 * HOUR - 15 * MIN).toISOString(),
    )
  })

  test("> 6h out items are dropped (leave to daily-insight)", () => {
    const db = makeDb()
    const now = new Date("2026-04-29T12:00:00Z")
    const dueAt = new Date(now.getTime() + 8 * HOUR).toISOString()
    const got = selectHeartbeatCandidates(
      db,
      [item({ itemId: "a", title: "HW", dueAt })],
      now,
    )
    expect(got).toHaveLength(0)
  })

  test("overdue item produces instant_overdue", () => {
    const db = makeDb()
    const now = new Date("2026-04-29T12:00:00Z")
    const dueAt = new Date(now.getTime() - 10 * MIN).toISOString()
    const got = selectHeartbeatCandidates(
      db,
      [item({ itemId: "a", title: "HW 1", dueAt })],
      now,
    )
    expect(got).toHaveLength(1)
    expect(got[0]?.kind).toBe("instant_overdue")
    expect(got[0]?.state).toBe("overdue")
  })

  test("overdue dedupe: prior overdue fire suppresses re-fire within window", () => {
    const db = makeDb()
    const now = new Date("2026-04-29T12:00:00Z")
    const dueMs = now.getTime() - 10 * MIN
    const dueAt = new Date(dueMs).toISOString()
    recordFire(db, "a", "overdue", dueMs)
    const got = selectHeartbeatCandidates(
      db,
      [item({ itemId: "a", title: "HW 1", dueAt })],
      now,
    )
    expect(got).toHaveLength(0)
  })

  test("imminent dedupe: prior due_soon suppresses re-fire", () => {
    const db = makeDb()
    const now = new Date("2026-04-29T12:00:00Z")
    const dueAt = new Date(now.getTime() + 20 * MIN).toISOString()
    recordFire(db, "a", "due_soon", now.getTime() - 30 * MIN)
    const got = selectHeartbeatCandidates(
      db,
      [item({ itemId: "a", title: "HW 1", dueAt })],
      now,
    )
    expect(got).toHaveLength(0)
  })

  test("passive items are never selected", () => {
    const db = makeDb()
    const now = new Date("2026-04-29T12:00:00Z")
    const dueAt = new Date(now.getTime() + 20 * MIN).toISOString()
    const got = selectHeartbeatCandidates(
      db,
      [
        item({
          itemId: "a",
          title: "Pre-reading: Ch 3",
          dueAt,
          assignmentType: "passive",
        }),
      ],
      now,
    )
    expect(got).toHaveLength(0)
  })

  test("ordering: instants come before schedules, then by proximity", () => {
    const db = makeDb()
    const now = new Date("2026-04-29T12:00:00Z")
    const items: UpcomingCourseworkRecord[] = [
      item({
        itemId: "future",
        title: "HW 1",
        dueAt: new Date(now.getTime() + 4 * HOUR).toISOString(),
      }),
      item({
        itemId: "imminent",
        title: "HW 2",
        dueAt: new Date(now.getTime() + 20 * MIN).toISOString(),
      }),
      item({
        itemId: "overdue",
        title: "HW 3",
        dueAt: new Date(now.getTime() - 5 * MIN).toISOString(),
      }),
    ]
    const got = selectHeartbeatCandidates(db, items, now)
    expect(got.map((c) => c.itemId)).toEqual(["overdue", "imminent", "future"])
  })

  test("items past-due by more than 7 days are dropped (stale, prior-term)", () => {
    const db = makeDb()
    const now = new Date("2026-04-29T12:00:00Z")
    const dueAt = new Date(now.getTime() - 30 * 24 * HOUR).toISOString()
    const got = selectHeartbeatCandidates(
      db,
      [item({ itemId: "old", title: "HW from last semester", dueAt })],
      now,
    )
    expect(got).toHaveLength(0)
  })

  test("items with null dueAt are dropped", () => {
    const db = makeDb()
    const now = new Date("2026-04-29T12:00:00Z")
    const got = selectHeartbeatCandidates(
      db,
      [{ ...item({ itemId: "a", title: "x", dueAt: "x" }), dueAt: null }],
      now,
    )
    expect(got).toHaveLength(0)
  })
})
