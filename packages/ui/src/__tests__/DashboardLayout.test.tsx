import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  DashboardLayout,
  DASHBOARD_SECTION_ORDER,
  type DashboardSectionSlot,
} from "../components/dashboard/DashboardLayout"

describe("DashboardLayout", () => {
  test("renders all section slot containers", () => {
    const sections: DashboardSectionSlot[] = DASHBOARD_SECTION_ORDER.map((id) => ({
      id,
      label: id,
      content: <div data-testid={`content-${id}`}>{id}</div>,
    }))

    render(<DashboardLayout sections={sections} />)

    // Every section element should be present
    for (const id of DASHBOARD_SECTION_ORDER) {
      expect(screen.getByTestId(`section-${id}`)).toBeDefined()
    }

    // All sections render their content immediately (no collapsed sections)
    const alwaysVisible = ["insights", "priorityQueue", "grades", "calendar", "quickActions"]
    for (const id of alwaysVisible) {
      expect(screen.getByTestId(`content-${id}`)).toBeDefined()
    }
  })

  test("renders skeleton when section content is null for primary slots", () => {
    const sections: DashboardSectionSlot[] = [
      { id: "grades", label: "Grades", content: null },
    ]

    render(<DashboardLayout sections={sections} />)

    expect(screen.getByTestId("skeleton-grades")).toBeDefined()
  })

  test("insights section is hidden when content is null", () => {
    const sections: DashboardSectionSlot[] = DASHBOARD_SECTION_ORDER.map((id) => ({
      id,
      label: id,
      content: id === "insights" ? null : <span>{id}</span>,
    }))

    render(<DashboardLayout sections={sections} />)

    // insights section not rendered when content is null
    expect(screen.queryByTestId("section-insights")).toBeNull()
  })

  test("sections DOM order: insights, priorityQueue, grades, calendar, quickActions", () => {
    const sections: DashboardSectionSlot[] = DASHBOARD_SECTION_ORDER.map((id) => ({
      id,
      label: id,
      content: <span>{id}</span>,
    }))

    render(<DashboardLayout sections={sections} />)

    const sectionElements = screen.getAllByTestId(/^section-/)
    const ids = sectionElements.map(
      (el) => el.getAttribute("data-testid")?.replace("section-", ""),
    )

    // insights first (strip), then two-col (priorityQueue, grades), then calendar, then quickActions
    expect(ids[0]).toBe("insights")
    expect(ids[1]).toBe("priorityQueue")
    expect(ids[2]).toBe("grades")
    expect(ids[3]).toBe("calendar")
    expect(ids[4]).toBe("quickActions")
  })

  test("DASHBOARD_SECTION_ORDER matches the spec order", () => {
    expect(DASHBOARD_SECTION_ORDER).toEqual([
      "priorityQueue",
      "insights",
      "calendar",
      "grades",
      "quickActions",
    ])
  })
})
