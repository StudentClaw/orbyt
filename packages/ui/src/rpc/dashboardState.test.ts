import { beforeEach, describe, expect, test } from "vitest"
import {
  applyDashboardUpdateEvent,
  getDashboardSections,
  resetDashboardStateForTests,
  updateDashboardSection,
} from "./dashboardState"

describe("dashboardState", () => {
  beforeEach(() => {
    resetDashboardStateForTests()
  })

  describe("initial state", () => {
    test("all sections have null lastUpdatedAt and no loading/error", () => {
      const sections = getDashboardSections()
      for (const key of Object.keys(sections) as Array<keyof typeof sections>) {
        expect(sections[key].lastUpdatedAt).toBeNull()
        expect(sections[key].loading).toBe(false)
        expect(sections[key].error).toBeNull()
      }
    })

    test("has all expected section keys", () => {
      const sections = getDashboardSections()
      const keys = Object.keys(sections)
      expect(keys).toContain("priorityQueue")
      expect(keys).toContain("insights")
      expect(keys).toContain("deadlines")
      expect(keys).toContain("calendar")
      expect(keys).toContain("grades")
      expect(keys).toContain("progress")
      expect(keys).toContain("announcements")
      expect(keys).toContain("quickActions")
    })
  })

  describe("updateDashboardSection", () => {
    test("updates a single section without affecting others", () => {
      updateDashboardSection("grades", { loading: true })
      const sections = getDashboardSections()
      expect(sections.grades.loading).toBe(true)
      expect(sections.deadlines.loading).toBe(false)
    })

    test("merges partial updates into existing section state", () => {
      updateDashboardSection("grades", { loading: true })
      updateDashboardSection("grades", { error: "fetch failed" })
      const sections = getDashboardSections()
      expect(sections.grades.loading).toBe(true)
      expect(sections.grades.error).toBe("fetch failed")
    })
  })

  describe("applyDashboardUpdateEvent", () => {
    test("sets lastUpdatedAt and clears loading/error for the section", () => {
      updateDashboardSection("grades", { loading: true, error: "stale" })
      applyDashboardUpdateEvent({ section: "grades" })
      const sections = getDashboardSections()
      expect(sections.grades.lastUpdatedAt).not.toBeNull()
      expect(sections.grades.loading).toBe(false)
      expect(sections.grades.error).toBeNull()
    })

    test("ignores unknown section names", () => {
      const before = getDashboardSections()
      applyDashboardUpdateEvent({ section: "nonexistent" })
      const after = getDashboardSections()
      expect(after).toEqual(before)
    })
  })

  describe("resetDashboardStateForTests", () => {
    test("resets all sections to initial state", () => {
      updateDashboardSection("grades", { loading: true, error: "fail" })
      updateDashboardSection("deadlines", { lastUpdatedAt: "2026-01-01" })

      resetDashboardStateForTests()

      const sections = getDashboardSections()
      expect(sections.grades.loading).toBe(false)
      expect(sections.grades.error).toBeNull()
      expect(sections.deadlines.lastUpdatedAt).toBeNull()
    })
  })
})
