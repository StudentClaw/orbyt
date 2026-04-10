import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  DashboardLayout,
  DASHBOARD_SECTION_ORDER,
  type DashboardSectionSlot,
} from "../components/dashboard/DashboardLayout"

describe("DashboardLayout", () => {
  test("renders all section slots in order", () => {
    const sections: DashboardSectionSlot[] = DASHBOARD_SECTION_ORDER.map((id) => ({
      id,
      label: id,
      content: <div data-testid={`content-${id}`}>{id}</div>,
    }))

    render(<DashboardLayout sections={sections} />)

    for (const id of DASHBOARD_SECTION_ORDER) {
      expect(screen.getByTestId(`section-${id}`)).toBeDefined()
      expect(screen.getByTestId(`content-${id}`)).toBeDefined()
    }
  })

  test("renders skeleton when section content is null", () => {
    const sections: DashboardSectionSlot[] = [
      { id: "grades", label: "Grades", content: null },
    ]

    render(<DashboardLayout sections={sections} />)

    expect(screen.getByTestId("skeleton-grades")).toBeDefined()
  })

  test("sections render in correct fixed order", () => {
    const sections: DashboardSectionSlot[] = DASHBOARD_SECTION_ORDER.map((id) => ({
      id,
      label: id,
      content: <span>{id}</span>,
    }))

    render(<DashboardLayout sections={sections} />)

    const sectionElements = screen.getAllByTestId(/^section-/)
    const ids = sectionElements.map((el) => el.getAttribute("data-testid")?.replace("section-", ""))
    expect(ids).toEqual([...DASHBOARD_SECTION_ORDER])
  })

  test("DASHBOARD_SECTION_ORDER matches the spec order", () => {
    expect(DASHBOARD_SECTION_ORDER).toEqual([
      "priorityQueue",
      "insights",
      "deadlines",
      "calendar",
      "grades",
      "progress",
      "announcements",
      "quickActions",
    ])
  })
})
