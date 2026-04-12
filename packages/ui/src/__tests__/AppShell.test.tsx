import { describe, test, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const shellMocks = vi.hoisted(() => ({
  pathname: "/",
  navigateFn: vi.fn(),
  onboardingComplete: true,
  isMobile: false,
}))

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div>Outlet</div>,
  useRouterState: () => ({ location: { pathname: shellMocks.pathname } }),
  useNavigate: () => shellMocks.navigateFn,
}))

vi.mock("../hooks/useAppRuntime", () => ({
  useIsOnboardingComplete: () => shellMocks.onboardingComplete,
  useIsServerHydrationComplete: () => true,
}))

vi.mock("../hooks/use-mobile", () => ({
  useIsMobile: () => shellMocks.isMobile,
}))

vi.mock("../components/shell/AppSidebar", () => ({
  AppSidebar: () => <div data-testid="mobile-sidebar">Sidebar</div>,
  AppSidebarContent: () => <div data-testid="desktop-sidebar-content">Sidebar</div>,
}))

vi.mock("../hooks/useNativeNotification", () => ({
  useNativeNotification: () => {},
}))

import { AppShell } from "../components/shell/AppShell"

describe("AppShell", () => {
  beforeEach(() => {
    shellMocks.pathname = "/"
    shellMocks.navigateFn.mockReset()
    shellMocks.onboardingComplete = true
    shellMocks.isMobile = false
    window.localStorage.clear()
  })

  test("renders the sidebar and outlet", () => {
    render(<AppShell />)
    expect(screen.getByTestId("desktop-sidebar-content")).toBeDefined()
    expect(screen.getByText("Outlet")).toBeDefined()
  })

  test("does not render the chat side panel", () => {
    render(<AppShell />)
    expect(screen.queryByTestId("chat-container")).toBeNull()
  })

  test("desktop trigger collapses and restores the sidebar", async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    expect(screen.getByTestId("desktop-sidebar-content")).toBeDefined()

    await user.click(screen.getByTestId("shell-sidebar-trigger"))
    expect(screen.queryByTestId("desktop-sidebar-content")).toBeNull()

    await user.click(screen.getByTestId("shell-sidebar-trigger"))
    expect(screen.getByTestId("desktop-sidebar-content")).toBeDefined()
  })

  test("mobile layout keeps using the sheet sidebar wrapper", () => {
    shellMocks.isMobile = true
    render(<AppShell />)

    expect(screen.getByTestId("mobile-sidebar")).toBeDefined()
    expect(screen.queryByTestId("desktop-sidebar-content")).toBeNull()
  })
})
