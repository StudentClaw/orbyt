import { describe, expect, test, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import type { ActivityFeedEntry } from "@student-claw/contracts"

let mockEntries: ReadonlyArray<ActivityFeedEntry> = []

vi.mock("@/rpc/activityState", () => ({
  useActivityEntries: () => mockEntries,
}))

beforeEach(() => {
  mockEntries = []
  ;(globalThis as any).window = {
    ...globalThis.window,
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
    expect(window.electronAPI?.invoke).not.toHaveBeenCalled()
  })

  test("fires notification when high priority entry is added", () => {
    const { rerender } = renderHook(() => useNativeNotification())

    // Simulate a new high-priority entry arriving
    mockEntries = [makeEntry("e1", 3)]
    rerender()

    expect(window.electronAPI?.invoke).toHaveBeenCalledWith(
      "notification:show",
      expect.objectContaining({ title: "Entry e1" }),
    )
  })

  test("does not fire notification for low priority entry", () => {
    const { rerender } = renderHook(() => useNativeNotification())

    mockEntries = [makeEntry("e1", 1)]
    rerender()

    expect(window.electronAPI?.invoke).not.toHaveBeenCalled()
  })

  test("does not fire notification for entry without priority", () => {
    const { rerender } = renderHook(() => useNativeNotification())

    mockEntries = [makeEntry("e1", undefined)]
    rerender()

    expect(window.electronAPI?.invoke).not.toHaveBeenCalled()
  })

  test("only fires for new entries, not existing ones", () => {
    mockEntries = [makeEntry("e1", 3)]
    const { rerender } = renderHook(() => useNativeNotification())

    // Re-render with same entries — should not fire again
    const invokeFn = window.electronAPI?.invoke as ReturnType<typeof vi.fn>
    invokeFn?.mockClear()

    rerender()
    expect(window.electronAPI?.invoke).not.toHaveBeenCalled()
  })
})
