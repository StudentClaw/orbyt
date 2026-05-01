import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ActivityFeedEntryWithMeta } from "@/rpc/activityState"
import { MOCK_ACTIVITY_ENTRIES } from "../__mocks__/activity-fixtures"

const activityMocks = vi.hoisted(() => ({
  entries: [] as ReadonlyArray<ActivityFeedEntryWithMeta>,
  filter: "all" as string,
  setFilter: vi.fn(),
  markAllRead: vi.fn(),
  unreadCount: 0,
}))

vi.mock("@/rpc/activityState", () => ({
  useActivityEntries: () => activityMocks.entries,
  useActivityFilter: () => activityMocks.filter,
  useActivityUnreadCount: () => activityMocks.unreadCount,
  setActivityFilter: (...args: unknown[]) => activityMocks.setFilter(...args),
  markAllActivityRead: (...args: unknown[]) => activityMocks.markAllRead(...args),
  filterActivityEntries: (entries: ReadonlyArray<ActivityFeedEntryWithMeta>, filter: string) =>
    filter === "all" ? entries : entries.filter((e) => e.category === filter),
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}))

import { ActivityCenter } from "../components/notifications/ActivityCenter"

describe("ActivityCenter", () => {
  beforeEach(() => {
    activityMocks.entries = MOCK_ACTIVITY_ENTRIES
    activityMocks.filter = "all"
    activityMocks.unreadCount = 3
    activityMocks.setFilter.mockClear()
    activityMocks.markAllRead.mockClear()
  })

  test("renders the activity center", () => {
    render(<ActivityCenter />)
    expect(screen.getByTestId("activity-center")).toBeDefined()
  })

  test("renders filter tabs", () => {
    render(<ActivityCenter />)
    expect(screen.getByTestId("activity-tabs")).toBeDefined()
    const tabs = screen.getByTestId("activity-tabs")
    expect(within(tabs).getByText("All")).toBeDefined()
    expect(within(tabs).getByText("Canvas")).toBeDefined()
    expect(within(tabs).getByText("Planner")).toBeDefined()
  })

  test("renders activity items", () => {
    render(<ActivityCenter />)
    expect(screen.getByTestId("activity-feed-list")).toBeDefined()
    // Should render all 5 mock entries
    for (const entry of MOCK_ACTIVITY_ENTRIES) {
      expect(screen.getByTestId(`activity-item-${entry.id}`)).toBeDefined()
    }
  })

  test("does not render an inline mark-all-read button (handled by sidebar Activity link)", () => {
    render(<ActivityCenter />)
    expect(screen.queryByTestId("activity-mark-read")).toBeNull()
  })

  test("clicking a filter tab calls setActivityFilter", async () => {
    render(<ActivityCenter />)
    await userEvent.click(within(screen.getByTestId("activity-tabs")).getByText("Canvas"))
    expect(activityMocks.setFilter).toHaveBeenCalledWith("canvas")
  })

  test("shows empty state when no entries", () => {
    activityMocks.entries = []
    render(<ActivityCenter />)
    expect(screen.getByText(/no notifications yet/i)).toBeDefined()
  })
})
