import { describe, expect, test, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"

const hookMocks = vi.hoisted(() => ({
  onboardingComplete: false,
  chatPanelOpen: false,
  chatPanelWidth: 33,
  pathname: "/",
  navigateFn: vi.fn(),
  setPanelWidth: vi.fn(),
}))

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div data-testid="outlet">outlet</div>,
  useRouterState: () => ({
    location: { pathname: hookMocks.pathname },
  }),
  useNavigate: () => hookMocks.navigateFn,
}))

vi.mock("@/hooks/useAppRuntime", () => ({
  useRuntimeChatPanelOpen: () => hookMocks.chatPanelOpen,
  useRuntimeChatPanelWidth: () => hookMocks.chatPanelWidth,
  useChatUiActions: () => ({
    setPanelWidth: hookMocks.setPanelWidth,
  }),
  useIsOnboardingComplete: () => hookMocks.onboardingComplete,
}))

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/chat/ChatContainer", () => ({
  ChatContainer: () => <div data-testid="chat-container" />,
}))

vi.mock("@/components/shell/AppSidebar", () => ({
  AppSidebar: () => <div data-testid="app-sidebar" />,
}))

vi.mock("@/hooks/useNativeNotification", () => ({
  useNativeNotification: () => {},
}))

import { AppShell } from "../components/shell/AppShell"

describe("onboarding guard", () => {
  beforeEach(() => {
    hookMocks.onboardingComplete = false
    hookMocks.pathname = "/"
    hookMocks.navigateFn.mockClear()
  })

  test("does not redirect when onboarding is incomplete while the guard is disabled", () => {
    hookMocks.onboardingComplete = false
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
