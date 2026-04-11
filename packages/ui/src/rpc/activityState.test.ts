import { beforeEach, describe, expect, test } from "vitest"
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
        entryId: "e1",
        title: "New grade posted",
        category: "canvas",
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
        entryId: "e1",
        title: "Original title",
        category: "canvas",
      })
      applyActivityFeedUpsertEvent({
        entryId: "e1",
        title: "Updated title",
        category: "canvas",
      })

      const entries = getActivityEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].title).toBe("Updated title")
      expect(getActivityUnreadCount()).toBe(1)
    })

    test("prepends new entries (newest first)", () => {
      applyActivityFeedUpsertEvent({
        entryId: "e1",
        title: "First",
        category: "canvas",
      })
      applyActivityFeedUpsertEvent({
        entryId: "e2",
        title: "Second",
        category: "planner",
      })

      const entries = getActivityEntries()
      expect(entries[0].id).toBe("e2")
      expect(entries[1].id).toBe("e1")
    })

    test("multiple new entries each increment unread count", () => {
      applyActivityFeedUpsertEvent({ entryId: "e1", title: "A", category: "canvas" })
      applyActivityFeedUpsertEvent({ entryId: "e2", title: "B", category: "planner" })
      applyActivityFeedUpsertEvent({ entryId: "e3", title: "C", category: "insight" })

      expect(getActivityUnreadCount()).toBe(3)
    })
  })

  describe("markAllActivityRead", () => {
    test("resets unread count to 0", () => {
      applyActivityFeedUpsertEvent({ entryId: "e1", title: "A", category: "canvas" })
      applyActivityFeedUpsertEvent({ entryId: "e2", title: "B", category: "planner" })
      expect(getActivityUnreadCount()).toBe(2)

      markAllActivityRead()
      expect(getActivityUnreadCount()).toBe(0)
    })

    test("does not remove entries", () => {
      applyActivityFeedUpsertEvent({ entryId: "e1", title: "A", category: "canvas" })
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
      applyActivityFeedUpsertEvent({ entryId: "e1", title: "A", category: "canvas" })
      setActivityFilter("planner")

      resetActivityStateForTests()

      expect(getActivityEntries()).toEqual([])
      expect(getActivityUnreadCount()).toBe(0)
      expect(getActivityFilter()).toBe("all")
    })
  })
})
