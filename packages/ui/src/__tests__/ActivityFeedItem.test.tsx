import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ActivityFeedEntry } from "@student-claw/contracts"

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}))

import { ActivityFeedItem } from "../components/notifications/ActivityFeedItem"

function makeEntry(overrides?: Partial<ActivityFeedEntry>): ActivityFeedEntry {
  return {
    id: "test-1" as any,
    category: "canvas",
    type: "grade_posted",
    title: "Test Entry",
    body: "Test body text",
    priority: 2,
    ...overrides,
  }
}

describe("ActivityFeedItem", () => {
  test("renders entry title and body", () => {
    render(<ActivityFeedItem entry={makeEntry()} />)
    expect(screen.getByTestId("activity-item-test-1")).toBeDefined()
    expect(screen.getByText("Test Entry")).toBeDefined()
    expect(screen.getByText("Test body text")).toBeDefined()
  })

  test("renders category label", () => {
    render(<ActivityFeedItem entry={makeEntry({ category: "planner" })} />)
    expect(screen.getByText("planner")).toBeDefined()
  })

  test("renders without body when body is undefined", () => {
    render(<ActivityFeedItem entry={makeEntry({ body: undefined })} />)
    expect(screen.getByText("Test Entry")).toBeDefined()
  })

  test("renders deep link indicator when deepLink present", () => {
    render(<ActivityFeedItem entry={makeEntry({ deepLink: "/" })} />)
    expect(screen.getByTestId("activity-item-link-test-1")).toBeDefined()
  })

  test("does not render deep link indicator when no deepLink", () => {
    render(<ActivityFeedItem entry={makeEntry({ deepLink: undefined })} />)
    expect(screen.queryByTestId("activity-item-link-test-1")).toBeNull()
  })
})
