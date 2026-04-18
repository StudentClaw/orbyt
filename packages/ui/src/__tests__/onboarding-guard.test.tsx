import { describe, expect, test, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"

const hookMocks = vi.hoisted(() => ({
  onboardingComplete: false,
  hydrationComplete: true,
  pathname: "/",
  navigateFn: vi.fn(),
  isMobile: false,
}))

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div data-testid="outlet">outlet</div>,
  useRouterState: (options?: { select?: (state: { location: { pathname: string } }) => unknown }) => {
    const state = {
      location: { pathname: hookMocks.pathname },
    }
    return options?.select ? options.select(state) : state
  },
  useNavigate: () => hookMocks.navigateFn,
}))

vi.mock("@/hooks/useAppRuntime", () => ({
  useIsOnboardingComplete: () => hookMocks.onboardingComplete,
  useIsServerHydrationComplete: () => hookMocks.hydrationComplete,
  useRuntimeConnectionStatus: () => ({
    phase: "connected" as const,
    wsUrl: "ws://127.0.0.1:8787",
    lastSequence: 0,
    lastError: null,
  }),
  useRuntimeOrchestrationSnapshot: () => null,
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => hookMocks.isMobile,
}))

vi.mock("@/components/shell/AppSidebar", () => ({
  AppSidebar: () => <div data-testid="app-sidebar" />,
  AppSidebarContent: () => <div data-testid="app-sidebar-content" />,
}))

vi.mock("@/hooks/useNativeNotification", () => ({
  useNativeNotification: () => {},
}))

import { AppShell } from "../components/shell/AppShell"

describe("onboarding guard", () => {
  beforeEach(() => {
    hookMocks.onboardingComplete = false
    hookMocks.hydrationComplete = true
    hookMocks.pathname = "/"
    hookMocks.isMobile = false
    hookMocks.navigateFn.mockClear()
  })

  test("redirects to /onboarding when hydration complete and onboarding incomplete", () => {
    hookMocks.onboardingComplete = false
    hookMocks.pathname = "/"

    render(<AppShell />)

    expect(hookMocks.navigateFn).toHaveBeenCalledWith({ to: "/onboarding" })
  })

  test("does not redirect when hydration is not yet complete", () => {
    hookMocks.onboardingComplete = false
    hookMocks.hydrationComplete = false
    hookMocks.pathname = "/"

    render(<AppShell />)

    expect(hookMocks.navigateFn).not.toHaveBeenCalled()
  })

  test("does not redirect when already on /onboarding", () => {
    hookMocks.onboardingComplete = false
    hookMocks.pathname = "/onboarding"

    render(<AppShell />)

    expect(hookMocks.navigateFn).not.toHaveBeenCalled()
  })

  test("does not redirect when onboarding is complete", () => {
    hookMocks.onboardingComplete = true
    hookMocks.pathname = "/"

    render(<AppShell />)

    expect(hookMocks.navigateFn).not.toHaveBeenCalled()
  })

  test("does not redirect when on /chat and onboarding is complete", () => {
    hookMocks.onboardingComplete = true
    hookMocks.pathname = "/chat"

    render(<AppShell />)

    expect(hookMocks.navigateFn).not.toHaveBeenCalled()
  })
})
