import { describe, test, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const shellMocks = vi.hoisted(() => ({
  pathname: "/",
  chatPanelOpen: false,
  chatPanelWidth: 33,
  setPanelWidth: vi.fn(),
  navigateFn: vi.fn(),
  onboardingComplete: true,
}))

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div>Outlet</div>,
  useRouterState: () => ({ location: { pathname: shellMocks.pathname } }),
  useNavigate: () => shellMocks.navigateFn,
}))

vi.mock("../hooks/useAppRuntime", () => ({
  useRuntimeChatPanelOpen: () => shellMocks.chatPanelOpen,
  useRuntimeChatPanelWidth: () => shellMocks.chatPanelWidth,
  useChatUiActions: () => ({ setPanelWidth: shellMocks.setPanelWidth }),
  useIsOnboardingComplete: () => shellMocks.onboardingComplete,
  useIsServerHydrationComplete: () => true,
}))

vi.mock("../components/shell/AppSidebar", () => ({
  AppSidebar: () => <div>Sidebar</div>,
}))

vi.mock("../components/chat/ChatContainer", () => ({
  ChatContainer: ({ variant }: { variant: string }) => (
    <div data-testid="chat-container">{variant}</div>
  ),
}))

vi.mock("../hooks/useNativeNotification", () => ({
  useNativeNotification: () => {},
}))

import { AppShell } from "../components/shell/AppShell"

describe("AppShell", () => {
  beforeEach(() => {
    shellMocks.pathname = "/"
    shellMocks.chatPanelOpen = false
    shellMocks.chatPanelWidth = 33
    shellMocks.setPanelWidth.mockReset()
  })

  test("renders the sidebar and outlet", () => {
    render(<AppShell />)
    expect(screen.getByText("Sidebar")).toBeDefined()
    expect(screen.getByText("Outlet")).toBeDefined()
  })

  test("shows the side panel on non-chat routes when open", () => {
    shellMocks.chatPanelOpen = true
    render(<AppShell />)
    expect(screen.getByTestId("chat-container").textContent).toBe("panel")
  })

  test("hides the side panel on /chat even when open", () => {
    shellMocks.pathname = "/chat"
    shellMocks.chatPanelOpen = true
    render(<AppShell />)
    expect(screen.queryByTestId("chat-container")).toBeNull()
  })
})
