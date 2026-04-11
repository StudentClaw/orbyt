import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/rpc/onboardingState", () => ({
  setAiAuthStatus: vi.fn(),
}))

vi.mock("@/rpc/appRuntime", () => ({
  getPrimaryWsRpcClient: () => ({
    onboarding: {
      setAiAuth: vi.fn().mockResolvedValue({}),
    },
  }),
}))

import { AiAuthStep } from "../components/onboarding/AiAuthStep"
import { setAiAuthStatus } from "@/rpc/onboardingState"

describe("AiAuthStep", () => {
  const defaultProps = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    window.electronAPI = {
      codexAuthStart: vi.fn().mockResolvedValue({ status: "connected" as const }),
      getBootstrap: vi.fn().mockResolvedValue(null),
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn().mockReturnValue(() => {}),
    }
  })

  test("renders the AI auth step", () => {
    render(<AiAuthStep {...defaultProps} />)
    expect(screen.getByTestId("ai-auth-step")).toBeDefined()
  })

  test("shows connect button", () => {
    render(<AiAuthStep {...defaultProps} />)
    expect(screen.getByTestId("ai-auth-connect-btn")).toBeDefined()
  })

  test("shows status indicator", () => {
    render(<AiAuthStep {...defaultProps} />)
    expect(screen.getByTestId("ai-auth-status")).toBeDefined()
    expect(screen.getByTestId("ai-auth-status").textContent).toBe("Not connected")
  })

  test("shows skip option", () => {
    render(<AiAuthStep {...defaultProps} />)
    expect(screen.getByTestId("ai-auth-skip")).toBeDefined()
  })

  test("clicking skip calls onNext", async () => {
    const user = userEvent.setup()
    render(<AiAuthStep {...defaultProps} />)
    await user.click(screen.getByTestId("ai-auth-skip"))
    expect(setAiAuthStatus).toHaveBeenCalledWith("skipped")
    expect(defaultProps.onNext).toHaveBeenCalledOnce()
  })

  test("clicking connect invokes codexAuthStart", async () => {
    const user = userEvent.setup()
    render(<AiAuthStep {...defaultProps} />)
    await user.click(screen.getByTestId("ai-auth-connect-btn"))
    expect(window.electronAPI!.codexAuthStart).toHaveBeenCalledOnce()
  })

  test("shows error when electronAPI unavailable", async () => {
    // @ts-expect-error -- simulating browser environment
    delete window.electronAPI
    const user = userEvent.setup()
    render(<AiAuthStep {...defaultProps} />)
    await user.click(screen.getByTestId("ai-auth-connect-btn"))
    expect(screen.getByTestId("ai-auth-error")).toBeDefined()
    expect(screen.getByTestId("ai-auth-error").textContent).toContain("Desktop bridge unavailable")
  })
})
