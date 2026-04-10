import type { PlannedSession } from "@student-claw/contracts"
import type { WsRpcClient } from "./wsRpcClient"
import { appAtomRegistry, createAtom, useAtomValue } from "./atomRegistry"

export interface PlannerStreamState {
  readonly stage: string
  readonly label: string
}

export interface PendingCheckIn {
  readonly sessionId: string
  readonly triggeredAt: string
}

const MAX_PENDING_CHECK_INS = 3

const plannedSessionsAtom = createAtom<ReadonlyArray<PlannedSession>>(
  "planner-sessions",
  [],
)

const pendingCheckInsAtom = createAtom<ReadonlyArray<PendingCheckIn>>(
  "planner-pending-check-ins",
  [],
)

const plannerStreamingAtom = createAtom<PlannerStreamState | null>(
  "planner-streaming",
  null,
)

const calendarViewWeekAtom = createAtom<string>(
  "planner-calendar-week",
  "",
)

// --- Imperative getters/setters ---

export function getPlannedSessions(): ReadonlyArray<PlannedSession> {
  return appAtomRegistry.get(plannedSessionsAtom)
}

export function setPlannedSessions(sessions: ReadonlyArray<PlannedSession>): void {
  appAtomRegistry.set(plannedSessionsAtom, sessions)
}

export function getPendingCheckIns(): ReadonlyArray<PendingCheckIn> {
  return appAtomRegistry.get(pendingCheckInsAtom)
}

export function getPlannerStreaming(): PlannerStreamState | null {
  return appAtomRegistry.get(plannerStreamingAtom)
}

export function setPlannerStreaming(state: PlannerStreamState | null): void {
  appAtomRegistry.set(plannerStreamingAtom, state)
}

export function getCalendarViewWeek(): string {
  return appAtomRegistry.get(calendarViewWeekAtom)
}

export function setCalendarViewWeek(weekStart: string): void {
  appAtomRegistry.set(calendarViewWeekAtom, weekStart)
}

// --- Event application ---

export function applySessionCheckInEvent(data: {
  readonly sessionId: string
  readonly triggeredAt: string
}): void {
  const current = appAtomRegistry.get(pendingCheckInsAtom)
  const next = [...current, { sessionId: data.sessionId, triggeredAt: data.triggeredAt }]

  appAtomRegistry.set(
    pendingCheckInsAtom,
    next.length > MAX_PENDING_CHECK_INS ? next.slice(next.length - MAX_PENDING_CHECK_INS) : next,
  )
}

// --- Planner stream stage messages ---

const STAGE_TEMPLATES: Record<string, (title?: string) => string> = {
  "task.analyzing": (title) => `Looking at your ${title ?? "task"}...`,
  "task.estimating": (title) => `Estimating how long ${title ?? "task"} will take...`,
  "slot.finding": () => "Checking your schedule for open time...",
  "session.placing": (title) => `Scheduling a session for ${title ?? "task"}...`,
  "plan.complete": () => "Your plan is ready!",
}

export function applyPlannerStreamEvent(data: {
  readonly stage: string
  readonly title?: string
}): void {
  const template = STAGE_TEMPLATES[data.stage]
  if (!template) return // silently skip unknown stages

  appAtomRegistry.set(plannerStreamingAtom, {
    stage: data.stage,
    label: template(data.title),
  })
}

// --- Sync starter ---

export function startPlannerStateSync(client: WsRpcClient): () => void {
  let disposed = false

  const cleanup = client.planner.onSessionCheckIn(
    (event) => {
      if (!disposed) {
        applySessionCheckInEvent({
          sessionId: event.sessionId,
          triggeredAt: event.triggeredAt,
        })
      }
    },
  )

  return () => {
    disposed = true
    cleanup()
  }
}

// --- React hooks ---

export function usePlannedSessions(): ReadonlyArray<PlannedSession> {
  return useAtomValue(plannedSessionsAtom)
}

export function usePendingCheckIns(): ReadonlyArray<PendingCheckIn> {
  return useAtomValue(pendingCheckInsAtom)
}

export function usePlannerStreaming(): PlannerStreamState | null {
  return useAtomValue(plannerStreamingAtom)
}

export function useCalendarViewWeek(): string {
  return useAtomValue(calendarViewWeekAtom)
}

// --- Test reset ---

export function resetPlannerStateForTests(): void {
  appAtomRegistry.set(plannedSessionsAtom, [])
  appAtomRegistry.set(pendingCheckInsAtom, [])
  appAtomRegistry.set(plannerStreamingAtom, null)
  appAtomRegistry.set(calendarViewWeekAtom, "")
}
