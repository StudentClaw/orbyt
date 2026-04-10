import { beforeEach, describe, expect, test } from "vitest"
import {
  applySessionCheckInEvent,
  getCalendarViewWeek,
  getPendingCheckIns,
  getPlannedSessions,
  getPlannerStreaming,
  resetPlannerStateForTests,
  setCalendarViewWeek,
  setPlannedSessions,
  setPlannerStreaming,
} from "./plannerState"
import type { PlannedSession } from "@student-claw/contracts"

function makeSession(id: string, overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: id as any,
    taskId: "t1" as any,
    courseId: "c1" as any,
    startTime: "2026-04-10T09:00:00Z",
    endTime: "2026-04-10T10:00:00Z",
    status: "scheduled",
    ...overrides,
  }
}

describe("plannerState", () => {
  beforeEach(() => {
    resetPlannerStateForTests()
  })

  describe("setPlannedSessions / getPlannedSessions", () => {
    test("stores and retrieves sessions", () => {
      const sessions = [makeSession("s1"), makeSession("s2")]
      setPlannedSessions(sessions)
      expect(getPlannedSessions()).toEqual(sessions)
    })

    test("returns empty array initially", () => {
      expect(getPlannedSessions()).toEqual([])
    })
  })

  describe("applySessionCheckInEvent", () => {
    test("adds to pending check-ins", () => {
      applySessionCheckInEvent({ sessionId: "s1", triggeredAt: "2026-04-10T10:00:00Z" })
      expect(getPendingCheckIns()).toHaveLength(1)
      expect(getPendingCheckIns()[0].sessionId).toBe("s1")
    })

    test("pending check-ins capped at 3 with FIFO eviction", () => {
      applySessionCheckInEvent({ sessionId: "s1", triggeredAt: "2026-04-10T10:00:00Z" })
      applySessionCheckInEvent({ sessionId: "s2", triggeredAt: "2026-04-10T11:00:00Z" })
      applySessionCheckInEvent({ sessionId: "s3", triggeredAt: "2026-04-10T12:00:00Z" })
      applySessionCheckInEvent({ sessionId: "s4", triggeredAt: "2026-04-10T13:00:00Z" })

      const checkIns = getPendingCheckIns()
      expect(checkIns).toHaveLength(3)
      expect(checkIns[0].sessionId).toBe("s2")
      expect(checkIns[2].sessionId).toBe("s4")
    })
  })

  describe("plannerStreaming", () => {
    test("stores and retrieves streaming state", () => {
      setPlannerStreaming({ stage: "task.analyzing", label: "Looking at your HW1..." })
      expect(getPlannerStreaming()).toEqual({ stage: "task.analyzing", label: "Looking at your HW1..." })
    })

    test("returns null initially", () => {
      expect(getPlannerStreaming()).toBeNull()
    })
  })

  describe("calendarViewWeek", () => {
    test("stores and retrieves week start date", () => {
      setCalendarViewWeek("2026-04-06")
      expect(getCalendarViewWeek()).toBe("2026-04-06")
    })
  })

  describe("resetPlannerStateForTests", () => {
    test("clears all atoms to initial values", () => {
      setPlannedSessions([makeSession("s1")])
      applySessionCheckInEvent({ sessionId: "s1", triggeredAt: "2026-04-10T10:00:00Z" })
      setPlannerStreaming({ stage: "plan.complete", label: "Done!" })
      setCalendarViewWeek("2026-04-06")

      resetPlannerStateForTests()

      expect(getPlannedSessions()).toEqual([])
      expect(getPendingCheckIns()).toEqual([])
      expect(getPlannerStreaming()).toBeNull()
      expect(getCalendarViewWeek()).toBe("")
    })
  })
})
