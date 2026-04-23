import { beforeEach, describe, expect, test } from "vitest"
import type { ActivityFeedEntry } from "@orbyt/contracts"
import {
  applyActivityFeedUpsertEvent,
  filterActivityEntries,
  getActivityEntries,
  getActivityFilter,
  getActivityUnreadCount,
  markAllActivityRead,
  resetActivityStateForTests,
  setActivityFilter,
  type ActivityFeedEntryWithMeta,
} from "./activityState"

function makeEntry(
  id: string,
  category: "canvas" | "planner" | "workflow" | "insight",
  overrides?: Partial<ActivityFeedEntryWithMeta>,
): ActivityFeedEntryWithMeta {
  return {
    id: id as any,
    category,
    type: "test_type",
    title: `Entry ${id}`,
    receivedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("activityState", () => {
  beforeEach(() => {
    resetActivityStateForTests()
  })

  describe("initial state", () => {
    test("entries are empty", () => {
      expect(getActivityEntries()).toEqual([])
    })

    test("unread count is 0", () => {
      expect(getActivityUnreadCount()).toBe(0)
    })

    test("filter is 'all'", () => {
      expect(getActivityFilter()).toBe("all")
    })
  })

  describe("applyActivityFeedUpsertEvent", () => {
    test("adds a new entry and increments unread count", () => {
      applyActivityFeedUpsertEvent({
        id: "e1" as ActivityFeedEntry["id"],
        title: "New grade posted",
        category: "canvas",
        type: "canvas_update",
      })

      const entries = getActivityEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].id).toBe("e1")
      expect(entries[0].title).toBe("New grade posted")
      expect(entries[0].category).toBe("canvas")
      expect(getActivityUnreadCount()).toBe(1)
    })

    test("updates existing entry without incrementing unread count", () => {
      applyActivityFeedUpsertEvent({
        id: "e1" as ActivityFeedEntry["id"],
        title: "Original title",
        category: "canvas",
        type: "canvas_update",
      })
      applyActivityFeedUpsertEvent({
        id: "e1" as ActivityFeedEntry["id"],
        title: "Updated title",
        category: "canvas",
        type: "canvas_update",
      })

      const entries = getActivityEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].title).toBe("Updated title")
      expect(getActivityUnreadCount()).toBe(1)
    })

    test("prepends new entries (newest first)", () => {
      applyActivityFeedUpsertEvent({
        id: "e1" as ActivityFeedEntry["id"],
        title: "First",
        category: "canvas",
        type: "canvas_update",
      })
      applyActivityFeedUpsertEvent({
        id: "e2" as ActivityFeedEntry["id"],
        title: "Second",
        category: "planner",
        type: "planner_update",
      })

      const entries = getActivityEntries()
      expect(entries[0].id).toBe("e2")
      expect(entries[1].id).toBe("e1")
    })

    test("multiple new entries each increment unread count", () => {
      applyActivityFeedUpsertEvent({ id: "e1" as ActivityFeedEntry["id"], title: "A", category: "canvas", type: "canvas_update" })
      applyActivityFeedUpsertEvent({ id: "e2" as ActivityFeedEntry["id"], title: "B", category: "planner", type: "planner_update" })
      applyActivityFeedUpsertEvent({ id: "e3" as ActivityFeedEntry["id"], title: "C", category: "insight", type: "weekly_summary" })

      expect(getActivityUnreadCount()).toBe(3)
    })

    test("preserves optional body, priority, and deep link fields from the feed payload", () => {
      applyActivityFeedUpsertEvent({
        id: "e9" as ActivityFeedEntry["id"],
        category: "workflow",
        type: "workflow_completed",
        title: "Workflow complete",
        body: "The agent finished your task.",
        priority: 3,
        deepLink: "/chat",
      })

      expect(getActivityEntries()[0]).toMatchObject({
        body: "The agent finished your task.",
        priority: 3,
        deepLink: "/chat",
      })
    })
  })

  describe("markAllActivityRead", () => {
    test("resets unread count to 0", () => {
      applyActivityFeedUpsertEvent({ id: "e1" as ActivityFeedEntry["id"], title: "A", category: "canvas", type: "canvas_update" })
      applyActivityFeedUpsertEvent({ id: "e2" as ActivityFeedEntry["id"], title: "B", category: "planner", type: "planner_update" })
      expect(getActivityUnreadCount()).toBe(2)

      markAllActivityRead()
      expect(getActivityUnreadCount()).toBe(0)
    })

    test("does not remove entries", () => {
      applyActivityFeedUpsertEvent({ id: "e1" as ActivityFeedEntry["id"], title: "A", category: "canvas", type: "canvas_update" })
      markAllActivityRead()
      expect(getActivityEntries()).toHaveLength(1)
    })
  })

  describe("setActivityFilter", () => {
    test("changes the filter value", () => {
      setActivityFilter("canvas")
      expect(getActivityFilter()).toBe("canvas")
    })

    test("can cycle through all filter values", () => {
      for (const f of ["all", "canvas", "planner", "workflow", "insight"] as const) {
        setActivityFilter(f)
        expect(getActivityFilter()).toBe(f)
      }
    })
  })

  describe("filterActivityEntries", () => {
    const entries: ReadonlyArray<ActivityFeedEntryWithMeta> = [
      makeEntry("e1", "canvas"),
      makeEntry("e2", "planner"),
      makeEntry("e3", "workflow"),
      makeEntry("e4", "insight"),
      makeEntry("e5", "canvas"),
    ]

    test("returns all entries when filter is 'all'", () => {
      expect(filterActivityEntries(entries, "all")).toHaveLength(5)
    })

    test("filters by canvas category", () => {
      const result = filterActivityEntries(entries, "canvas")
      expect(result).toHaveLength(2)
      expect(result.every((e) => e.category === "canvas")).toBe(true)
    })

    test("filters by planner category", () => {
      expect(filterActivityEntries(entries, "planner")).toHaveLength(1)
    })

    test("filters by workflow category", () => {
      expect(filterActivityEntries(entries, "workflow")).toHaveLength(1)
    })

    test("filters by insight category", () => {
      expect(filterActivityEntries(entries, "insight")).toHaveLength(1)
    })

    test("returns empty array when no entries match", () => {
      const canvasOnly = [makeEntry("e1", "canvas")]
      expect(filterActivityEntries(canvasOnly, "planner")).toHaveLength(0)
    })
  })

  describe("resetActivityStateForTests", () => {
    test("clears all atoms to initial values", () => {
      applyActivityFeedUpsertEvent({ id: "e1" as ActivityFeedEntry["id"], title: "A", category: "canvas", type: "canvas_update" })
      setActivityFilter("planner")

      resetActivityStateForTests()

      expect(getActivityEntries()).toEqual([])
      expect(getActivityUnreadCount()).toBe(0)
      expect(getActivityFilter()).toBe("all")
    })
  })
})
