import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ActivityFeedEntryWithMeta } from "@/rpc/activityState"

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}))

import { ActivityFeedItem } from "../components/notifications/ActivityFeedItem"

function makeEntry(overrides?: Partial<ActivityFeedEntryWithMeta>): ActivityFeedEntryWithMeta {
  return {
    id: "test-1" as any,
    category: "canvas",
    type: "grade_posted",
    title: "Test Entry",
    body: "Test body text",
    priority: 2,
    receivedAt: new Date().toISOString(),
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

  test("does not render category label badge", () => {
    render(<ActivityFeedItem entry={makeEntry({ category: "planner" })} />)
    expect(screen.queryByText("Planner")).toBeNull()
  })

  test("renders without body when body is undefined", () => {
    render(<ActivityFeedItem entry={makeEntry({ body: undefined })} />)
    expect(screen.getByText("Test Entry")).toBeDefined()
  })

  test("insight variant renders multi-line body with whitespace-pre-line", () => {
    const body = [
      "✨ Yesterday you logged 90min on PS6",
      "⚠ Calc midterm Wed 9am — block 2 review sessions",
      "⏰ CHEM 230 Quiz tomorrow 2pm",
    ].join("\n")
    render(
      <ActivityFeedItem
        entry={makeEntry({
          id: "ins-1" as any,
          category: "insight",
          title: "Calc midterm in 2 days",
          body,
        })}
      />,
    )
    expect(screen.getByText("Calc midterm in 2 days")).toBeDefined()
    const bodyEl = screen.getByTestId("activity-item-body-ins-1")
    expect(bodyEl).toBeDefined()
    expect(bodyEl.className).toContain("whitespace-pre-line")
    expect(bodyEl.textContent).toContain("Calc midterm Wed 9am")
    expect(bodyEl.textContent).toContain("CHEM 230 Quiz tomorrow 2pm")
  })

  test("non-insight bodies still preserve newlines for readability", () => {
    render(
      <ActivityFeedItem
        entry={makeEntry({
          id: "cron-1" as any,
          category: "cron",
          title: "Calc HW due in 5 min",
          body: "Open Canvas to start\nDouble-check rubric",
        })}
      />,
    )
    const bodyEl = screen.getByTestId("activity-item-body-cron-1")
    expect(bodyEl.className).toContain("whitespace-pre-line")
    expect(bodyEl.textContent).toContain("Double-check rubric")
  })

  test("insight notifications simplify Canvas-style course codes in title and body", () => {
    render(
      <ActivityFeedItem
        entry={makeEntry({
          id: "ins-codes" as any,
          category: "insight",
          title: "FA24_MATH101_LEC_SEC1 midterm in 2 days",
          body: "Block review for FA24_MATH101_LEC_SEC1 tomorrow",
        })}
      />,
    )
    expect(screen.getByText("MATH101 midterm in 2 days")).toBeDefined()
    expect(
      screen.getByTestId("activity-item-body-ins-codes").textContent,
    ).toContain("Block review for MATH101 tomorrow")
  })

  test("cron (proactive) notifications simplify course codes too", () => {
    render(
      <ActivityFeedItem
        entry={makeEntry({
          id: "cron-codes" as any,
          category: "cron",
          title: "SP25_CHEM230_LAB_001 quiz starts in 4h",
          body: "Heads up",
        })}
      />,
    )
    expect(screen.getByText("CHEM230 quiz starts in 4h")).toBeDefined()
  })

  test("non-insight/cron categories leave course codes untouched", () => {
    render(
      <ActivityFeedItem
        entry={makeEntry({
          id: "canvas-codes" as any,
          category: "canvas",
          title: "FA24_MATH101_LEC_SEC1 grade posted",
          body: "Score: 95",
        })}
      />,
    )
    expect(screen.getByText("FA24_MATH101_LEC_SEC1 grade posted")).toBeDefined()
  })

  test("insight entries are not clickable even when deepLink is set", () => {
    render(
      <ActivityFeedItem
        entry={makeEntry({
          id: "i-2" as any,
          category: "insight",
          deepLink: "/courses/calc",
          title: "Calc midterm",
          body: "...",
        })}
      />,
    )
    const card = screen.getByTestId("activity-item-i-2")
    expect(card.className).not.toContain("cursor-pointer")
  })
})
