import { describe, expect, test, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import type { ActivityFeedEntry } from "@orbyt/contracts"

let mockEntries: ReadonlyArray<ActivityFeedEntry> = []
const notificationMocks = {
  create: vi.fn(),
}

vi.mock("@/rpc/activityState", () => ({
  useActivityEntries: () => mockEntries,
}))

beforeEach(() => {
  mockEntries = []
  notificationMocks.create.mockClear()
  ;(globalThis as any).window = {
    ...globalThis.window,
    Notification: class MockNotification {
      static permission: NotificationPermission = "granted"

      constructor(title: string, options?: NotificationOptions) {
        notificationMocks.create(title, options)
      }
    },
    electronAPI: {
      invoke: vi.fn(),
    },
  }
})

import { useNativeNotification } from "../hooks/useNativeNotification"

function makeEntry(id: string, priority?: number): ActivityFeedEntry {
  return {
    id: id as any,
    category: "planner",
    type: "test",
    title: `Entry ${id}`,
    body: `Body for ${id}`,
    priority,
  }
}

describe("useNativeNotification", () => {
  test("does not fire notification on initial render with empty entries", () => {
    renderHook(() => useNativeNotification())
    expect(notificationMocks.create).not.toHaveBeenCalled()
    expect(window.electronAPI?.invoke).not.toHaveBeenCalled()
  })

  test("fires notification when high priority entry is added", () => {
    const { rerender } = renderHook(() => useNativeNotification())

    // Simulate a new high-priority entry arriving
    mockEntries = [makeEntry("e1", 3)]
    rerender()

    expect(notificationMocks.create).toHaveBeenCalledWith(
      "Entry e1",
      expect.objectContaining({ body: "Body for e1" }),
    )
  })

  test("does not fire notification for low priority entry", () => {
    const { rerender } = renderHook(() => useNativeNotification())

    mockEntries = [makeEntry("e1", 1)]
    rerender()

    expect(notificationMocks.create).not.toHaveBeenCalled()
  })

  test("does not fire notification for entry without priority", () => {
    const { rerender } = renderHook(() => useNativeNotification())

    mockEntries = [makeEntry("e1", undefined)]
    rerender()

    expect(notificationMocks.create).not.toHaveBeenCalled()
  })

  test("only fires for new entries, not existing ones", () => {
    mockEntries = [makeEntry("e1", 3)]
    const { rerender } = renderHook(() => useNativeNotification())

    // Re-render with same entries — should not fire again
    notificationMocks.create.mockClear()

    rerender()
    expect(notificationMocks.create).not.toHaveBeenCalled()
  })
})
