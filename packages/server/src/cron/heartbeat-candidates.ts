import type { DatabaseService } from "../db/Database.js"
import type { UpcomingCourseworkRecord } from "./insight-context.js"
import {
  shouldFireForState,
  shouldFireOverdueAt,
  type HeartbeatFireState,
} from "./heartbeat-dedupe.js"

const MIN_MS = 60 * 1000
const HOUR_MS = 60 * MIN_MS

const INSTANT_WINDOW_MS = 30 * MIN_MS
const SCHEDULE_HORIZON_MS = 6 * HOUR_MS
// Items past-due by more than this are considered stale (prior term, already
// addressed, or otherwise irrelevant) and are dropped so they never fire.
const OVERDUE_MAX_AGE_MS = 7 * 24 * HOUR_MS

const ASSESSMENT_LEAD_MIN = 15
const WORK_LEAD_MIN = 120

export type HeartbeatCandidateKind = "instant_overdue" | "instant_imminent" | "schedule_later"

export interface HeartbeatCandidate {
  readonly kind: HeartbeatCandidateKind
  readonly state: HeartbeatFireState
  readonly itemId: string
  readonly course: string
  readonly title: string
  readonly assignmentType: "assessment" | "work" | "passive"
  readonly dueAt: string
  readonly dueAtMs: number
  readonly minutesUntil: number
  readonly htmlUrl: string | null
  /** For schedule_later: the ISO timestamp when the reminder should fire. */
  readonly scheduleAtIso?: string
}

function leadMinutesForType(t: HeartbeatCandidate["assignmentType"]): number {
  return t === "assessment" ? ASSESSMENT_LEAD_MIN : WORK_LEAD_MIN
}

/**
 * Filter the upcoming-coursework list down to items that should drive a fire
 * this tick, given the dedupe log. Pure-ish: only side effect is reading from
 * the dedupe log (no writes). Caller decides whether to invoke the LLM and is
 * responsible for `recordFire` once entries are persisted.
 */
export function selectHeartbeatCandidates(
  database: DatabaseService,
  items: ReadonlyArray<UpcomingCourseworkRecord>,
  now: Date = new Date(),
): ReadonlyArray<HeartbeatCandidate> {
  const nowMs = now.getTime()
  const out: HeartbeatCandidate[] = []

  for (const item of items) {
    if (item.dueAt === null) continue
    if (item.assignmentType === "passive") continue // passives don't drive heartbeat fires

    const dueMs = Date.parse(item.dueAt)
    if (!Number.isFinite(dueMs)) continue

    const minutesUntil = (dueMs - nowMs) / MIN_MS

    // Overdue. Drop items past-due by more than OVERDUE_MAX_AGE so we never
    // re-fire stale items from previous terms.
    if (dueMs < nowMs) {
      if (nowMs - dueMs > OVERDUE_MAX_AGE_MS) continue
      if (!shouldFireOverdueAt(database, item.itemId, dueMs, nowMs)) continue
      out.push({
        kind: "instant_overdue",
        state: "overdue",
        itemId: item.itemId,
        course: item.course,
        title: item.title,
        assignmentType: item.assignmentType,
        dueAt: item.dueAt,
        dueAtMs: dueMs,
        minutesUntil,
        htmlUrl: item.htmlUrl,
      })
      continue
    }

    // Imminent (≤30 min)
    if (dueMs - nowMs <= INSTANT_WINDOW_MS) {
      const state: HeartbeatFireState =
        item.assignmentType === "assessment" ? "starting_soon" : "due_soon"
      if (!shouldFireForState(database, item.itemId, state, nowMs)) continue
      out.push({
        kind: "instant_imminent",
        state,
        itemId: item.itemId,
        course: item.course,
        title: item.title,
        assignmentType: item.assignmentType,
        dueAt: item.dueAt,
        dueAtMs: dueMs,
        minutesUntil,
        htmlUrl: item.htmlUrl,
      })
      continue
    }

    // Schedule (30min – 6h)
    if (dueMs - nowMs <= SCHEDULE_HORIZON_MS) {
      const state: HeartbeatFireState =
        item.assignmentType === "assessment" ? "starting_soon" : "due_soon"
      if (!shouldFireForState(database, item.itemId, state, nowMs)) continue
      const leadMin = leadMinutesForType(item.assignmentType)
      const scheduleAtMs = dueMs - leadMin * MIN_MS
      // Don't schedule in the past or within the next 5 min.
      if (scheduleAtMs - nowMs < 5 * MIN_MS) continue
      const scheduleAtIso = new Date(scheduleAtMs).toISOString()
      out.push({
        kind: "schedule_later",
        state,
        itemId: item.itemId,
        course: item.course,
        title: item.title,
        assignmentType: item.assignmentType,
        dueAt: item.dueAt,
        dueAtMs: dueMs,
        minutesUntil,
        htmlUrl: item.htmlUrl,
        scheduleAtIso,
      })
      continue
    }
    // > 6h out — leave to daily-insight
  }

  // Cap to 6 candidates, prioritizing instants > schedules, then by proximity.
  const ordered = [...out].sort((a, b) => {
    const order = { instant_overdue: 0, instant_imminent: 1, schedule_later: 2 } as const
    if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind]
    return a.dueAtMs - b.dueAtMs
  })
  return ordered.slice(0, 6)
}
