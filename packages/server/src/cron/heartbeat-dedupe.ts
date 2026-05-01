import type { DatabaseService } from "../db/Database.js"

export const HEARTBEAT_FIRE_STATES = ["starting_soon", "due_soon", "overdue"] as const
export type HeartbeatFireState = typeof HEARTBEAT_FIRE_STATES[number]

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/**
 * Overdue schedule: T+0, then at most once per 24h.
 *
 * Earlier exponential schedule (T+0, +2h, +8h, +24h) was too noisy in
 * practice — same item fired 2-3 times within a day. Now: fire once when
 * the item first goes overdue, then nudge once per day until it's acted on,
 * dismissed, or archived.
 */
const OVERDUE_SCHEDULE_MS = [0, 24 * HOUR_MS]

interface FireRow {
  fired_at: number
}

function lastFireAt(
  database: DatabaseService,
  itemId: string,
  state: HeartbeatFireState,
): number | null {
  const row = database.get<FireRow>(
    `SELECT fired_at FROM heartbeat_fire_log
       WHERE item_id = ? AND state = ?
       ORDER BY fired_at DESC LIMIT 1`,
    [itemId, state],
  )
  return row?.fired_at ?? null
}

function fireCount(
  database: DatabaseService,
  itemId: string,
  state: HeartbeatFireState,
): number {
  const row = database.get<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM heartbeat_fire_log
       WHERE item_id = ? AND state = ?`,
    [itemId, state],
  )
  return row?.cnt ?? 0
}

/**
 * For non-overdue states (`starting_soon`, `due_soon`), fire at most once per
 * (item, state) pair. Daily-insight resets are out of scope for v1; if a
 * student needs the same item to re-fire later, they'd archive/unarchive.
 */
export function shouldFireForState(
  database: DatabaseService,
  itemId: string,
  state: Exclude<HeartbeatFireState, "overdue">,
  _now: number,
): boolean {
  return lastFireAt(database, itemId, state) === null
}

/**
 * Overdue: exponential backoff. Fires when `now` is past the next scheduled
 * step relative to `overdueSince`, AND the prior fire is at least the
 * step-duration ago (prevents same-tick double-fire).
 */
export function shouldFireOverdueAt(
  database: DatabaseService,
  itemId: string,
  overdueSince: number,
  now: number,
): boolean {
  if (now < overdueSince) return false

  const fires = fireCount(database, itemId, "overdue")
  const last = lastFireAt(database, itemId, "overdue")

  // No prior fire — always eligible (T+0).
  if (fires === 0 || last === null) {
    return true
  }

  // Within the discrete schedule.
  if (fires < OVERDUE_SCHEDULE_MS.length) {
    const nextStep = OVERDUE_SCHEDULE_MS[fires]
    if (nextStep === undefined) return false
    const nextAt = overdueSince + nextStep
    return now >= nextAt
  }

  // After the schedule: once per day.
  return now - last >= DAY_MS
}

export function recordFire(
  database: DatabaseService,
  itemId: string,
  state: HeartbeatFireState,
  firedAt: number,
): void {
  try {
    database.execute(
      `INSERT INTO heartbeat_fire_log (item_id, state, fired_at) VALUES (?, ?, ?)`,
      [itemId, state, firedAt],
    )
  } catch {
    // Duplicate (same item/state/timestamp) — safe to ignore.
  }
}
