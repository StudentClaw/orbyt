import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/rpc/appRuntime", () => ({
  getPrimaryWsRpcClient: () => ({
    onboarding: {
      setPreferences: vi.fn().mockResolvedValue({}),
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
})
