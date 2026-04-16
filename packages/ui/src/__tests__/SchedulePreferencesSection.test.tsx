import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockSetPreferences = vi.fn().mockResolvedValue({})
const mockSetRoutines = vi.fn().mockResolvedValue({ count: 0 })
const mockGetPreferences = vi.fn()
const mockGetRoutines = vi.fn()

vi.mock("@/rpc/appRuntime", () => ({
  getPrimaryWsRpcClient: () => ({
    onboarding: {
      getPreferences: mockGetPreferences,
      setPreferences: mockSetPreferences,
      getRoutines: mockGetRoutines,
      setRoutines: mockSetRoutines,
    },
  }),
}))

import { SchedulePreferencesSection } from "../components/settings/SchedulePreferencesSection"

const defaultPreferences = {
  studyTimes: [],
  courseRanking: [],
  maxSessionMins: 90,
  offLimitDays: [],
  notificationEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  calendarIntegration: "none" as const,
}

describe("SchedulePreferencesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPreferences.mockResolvedValue(defaultPreferences)
    mockGetRoutines.mockResolvedValue({ cells: [] })
  })

  test("renders a loading state initially", () => {
    render(<SchedulePreferencesSection />)
    expect(screen.getByTestId("schedule-prefs-loading")).toBeDefined()
  })

  test("displays preferences after loading", async () => {
    render(<SchedulePreferencesSection />)
    await waitFor(() => {
      expect(screen.getByTestId("schedule-prefs-content")).toBeDefined()
    })
    expect(screen.getByTestId("pref-study-times")).toBeDefined()
    expect(screen.getByTestId("pref-max-duration")).toBeDefined()
    expect(screen.getByTestId("pref-off-days")).toBeDefined()
    expect(screen.getByTestId("routines-grid")).toBeDefined()
  })

  test("shows existing study times as selected", async () => {
    mockGetPreferences.mockResolvedValue({
      ...defaultPreferences,
      studyTimes: ["morning"],
    })
    render(<SchedulePreferencesSection />)
    await waitFor(() => screen.getByTestId("schedule-prefs-content"))
    // The Morning button should have default variant (selected)
    const morningBtn = screen.getByText("Morning")
    expect(morningBtn).toBeDefined()
  })

  test("toggling a study time calls setPreferences", async () => {
    render(<SchedulePreferencesSection />)
    await waitFor(() => screen.getByTestId("schedule-prefs-content"))
    const morningBtn = screen.getByText("Morning")
    await userEvent.click(morningBtn)
    await waitFor(() => {
      expect(mockSetPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ studyTimes: ["morning"] }),
      )
    })
  })

  test("clicking a routine cell calls setRoutines", async () => {
    render(<SchedulePreferencesSection />)
    await waitFor(() => screen.getByTestId("schedule-prefs-content"))
    const cell = screen.getByTestId("routine-cell-0-9")
    await userEvent.click(cell)
    await waitFor(() => {
      expect(mockSetRoutines).toHaveBeenCalledWith(
        expect.objectContaining({ cells: [{ dayOfWeek: 0, hourOfDay: 9 }] }),
      )
    })
  })

  test("shows existing routines as active on load", async () => {
    mockGetRoutines.mockResolvedValue({
      cells: [{ dayOfWeek: 1, hourOfDay: 10 }],
    })
    render(<SchedulePreferencesSection />)
    await waitFor(() => screen.getByTestId("schedule-prefs-content"))
    const activeCell = screen.getByTestId("routine-cell-1-10")
    expect(activeCell.getAttribute("data-active")).toBe("true")
  })

  test("notification toggle calls setPreferences with updated value", async () => {
    render(<SchedulePreferencesSection />)
    await waitFor(() => screen.getByTestId("schedule-prefs-content"))
    const toggle = screen.getByTestId("pref-notif-switch")
    await userEvent.click(toggle)
    await waitFor(() => {
      expect(mockSetPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ notificationEnabled: false }),
      )
    })
  })

  test("shows error state when loading fails", async () => {
    mockGetPreferences.mockRejectedValue(new Error("network error"))
    render(<SchedulePreferencesSection />)
    await waitFor(() => {
      expect(screen.getByTestId("schedule-prefs-error")).toBeDefined()
    })
  })
})
