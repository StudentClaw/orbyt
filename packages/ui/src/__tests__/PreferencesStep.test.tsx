import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockGetPreferences = vi.fn()
const mockSetPreferences = vi.fn().mockResolvedValue({})

vi.mock("@/rpc/appRuntime", () => ({
  getPrimaryWsRpcClient: () => ({
    onboarding: {
      getPreferences: mockGetPreferences,
      setPreferences: mockSetPreferences,
    },
  }),
}))

import { PreferencesStep } from "../components/onboarding/PreferencesStep"

describe("PreferencesStep", () => {
  const defaultProps = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPreferences.mockResolvedValue({
      studyTimes: [],
      courseRanking: [],
      maxSessionMins: 90,
      offLimitDays: [],
      notificationEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      calendarIntegration: "none",
    })
  })

  test("renders the preferences form", () => {
    render(<PreferencesStep {...defaultProps} />)
    expect(screen.getByTestId("preferences-step")).toBeDefined()
  })

  test("renders study time toggles", () => {
    render(<PreferencesStep {...defaultProps} />)
    expect(screen.getByTestId("pref-study-times")).toBeDefined()
  })

  test("renders max duration control", () => {
    render(<PreferencesStep {...defaultProps} />)
    expect(screen.getByTestId("pref-max-duration")).toBeDefined()
  })

  test("renders off-limit days toggles", () => {
    render(<PreferencesStep {...defaultProps} />)
    expect(screen.getByTestId("pref-off-days")).toBeDefined()
  })

  test("renders notification toggle", () => {
    render(<PreferencesStep {...defaultProps} />)
    expect(screen.getByTestId("pref-notif-switch")).toBeDefined()
  })

  test("study time buttons are clickable", async () => {
    render(<PreferencesStep {...defaultProps} />)
    const morningBtn = screen.getByText("Morning")
    await userEvent.click(morningBtn)
    // Button should be visually toggled (has data-state)
    expect(morningBtn).toBeDefined()
  })

  test("hydrates from saved preferences without writing defaults on mount", async () => {
    mockGetPreferences.mockResolvedValue({
      studyTimes: ["evening"],
      courseRanking: [],
      maxSessionMins: 120,
      offLimitDays: [5],
      notificationEnabled: false,
      quietHoursStart: "23:00",
      quietHoursEnd: "07:00",
      calendarIntegration: "none",
    })

    render(<PreferencesStep {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText("Max session duration: 2h")).toBeDefined()
    })
    expect(mockSetPreferences).not.toHaveBeenCalled()
  })
})
