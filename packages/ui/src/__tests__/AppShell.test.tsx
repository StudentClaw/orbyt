import { describe, test, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { OrchestrationSnapshot } from "@student-claw/contracts"
import type { WsConnectionStatus } from "../rpc/wsConnectionState"

const shellMocks = vi.hoisted(() => ({
  pathname: "/",
  navigateFn: vi.fn(),
  onboardingComplete: true,
  isMobile: false,
  pluginName: "Canvas Assistant",
  snapshot: null as OrchestrationSnapshot | null,
  connectionStatus: {
    phase: "connected",
    wsUrl: "ws://127.0.0.1:8787",
    lastSequence: 0,
    lastError: null,
  } as WsConnectionStatus,
}))

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div>Outlet</div>,
  useRouterState: ({
    select,
  }: {
    select?: (state: { location: { pathname: string } }) => unknown
  } = {}) => {
    const state = { location: { pathname: shellMocks.pathname } }
    return select ? select(state) : state
  },
  useNavigate: () => shellMocks.navigateFn,
}))

vi.mock("../hooks/useAppRuntime", () => ({
  useIsOnboardingComplete: () => shellMocks.onboardingComplete,
  useIsServerHydrationComplete: () => true,
  useRuntimeBootstrap: () => ({
    featureFlags: {
      pluginSystem: true,
    },
  }),
  useRuntimeConnectionStatus: () => shellMocks.connectionStatus,
  useRuntimeOrchestrationSnapshot: () => shellMocks.snapshot,
}))

vi.mock("../hooks/usePluginRegistry", () => ({
  usePluginDisplayName: (pluginId: string | null) => (pluginId ? shellMocks.pluginName : null),
}))

vi.mock("../hooks/use-mobile", () => ({
  useIsMobile: () => shellMocks.isMobile,
}))

vi.mock("../components/shell/AppSidebar", async () => {
  const { useSidebar } = await import("../components/ui/sidebar")

  return {
    AppSidebar: () => <div data-testid="mobile-sidebar">Sidebar</div>,
    AppSidebarContent: () => {
      const { open } = useSidebar()

      return <>{open ? <div data-testid="desktop-sidebar-content">Sidebar</div> : null}</>
    },
  }
})

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
    shellMocks.pluginName = "Canvas Assistant"
    shellMocks.snapshot = null
    shellMocks.connectionStatus = {
      phase: "connected",
      wsUrl: "ws://127.0.0.1:8787",
      lastSequence: 0,
      lastError: null,
    }
    window.localStorage.clear()
  })

  test("renders the sidebar, universal navbar, and outlet", () => {
    render(<AppShell />)
    expect(screen.getByTestId("root-navbar")).toBeDefined()
    expect(screen.getByTestId("root-navbar-title").textContent).toBe("Dashboard")
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
    expect(screen.getByTestId("root-navbar")).toBeDefined()
    expect(screen.queryByTestId("desktop-sidebar-content")).toBeNull()
  })

  test("shows the active chat thread in the root breadcrumb", () => {
    shellMocks.pathname = "/chat/workspace-1/thread-1"
    shellMocks.snapshot = {
      workspaces: [
        {
          id: "workspace-1" as never,
          kind: "filesystem",
          name: "Course repo",
          rootPath: "/repo",
          availability: "ready",
          createdAt: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      ],
      threads: [
        {
          id: "thread-1" as never,
          workspaceId: "workspace-1" as never,
          title: "Weekly planning",
          accessMode: "default",
          status: "completed",
          createdAt: "2026-04-09T00:00:00.000Z",
          currentTurnId: null,
        },
      ],
      turns: [],
      pendingApprovals: [],
      providerStatus: "idle",
      providerRuntime: {
        adapter: "codex",
        status: "idle",
        authState: "authenticated",
        lastError: null,
        queuedTurnCount: 0,
        lastUpdatedAt: "2026-04-09T00:00:00.000Z",
      },
      ready: true,
      lastSequence: 1,
    }

    render(<AppShell />)

    expect(screen.getByLabelText("breadcrumb")).toBeDefined()
    expect(screen.getByText("Chat")).toBeDefined()
    expect(screen.getByText("Course repo")).toBeDefined()
    expect(screen.getByText("Weekly planning")).toBeDefined()
    expect(screen.getByTestId("chat-status-badge").textContent).toContain("Ready")
  })

  test("shows an offline chat badge only on chat routes", () => {
    shellMocks.pathname = "/chat"
    shellMocks.connectionStatus = {
      phase: "disconnected",
      wsUrl: "ws://127.0.0.1:8787",
      lastSequence: 0,
      lastError: "Socket closed",
    }

    render(<AppShell />)

    expect(screen.getByTestId("chat-status-badge").textContent).toContain("Offline")
  })

  test("shows a preparing chat badge while the provider is still warming", () => {
    shellMocks.pathname = "/chat"
    shellMocks.snapshot = {
      workspaces: [],
      threads: [],
      turns: [],
      pendingApprovals: [],
      providerStatus: "offline",
      providerRuntime: {
        adapter: "codex",
        status: "offline",
        authState: "unknown",
        lastError: null,
        queuedTurnCount: 0,
        lastUpdatedAt: "2026-04-09T00:00:00.000Z",
      },
      ready: true,
      lastSequence: 1,
    }

    render(<AppShell />)

    expect(screen.getByTestId("chat-status-badge").textContent).toContain("Preparing")
  })

  test("shows settings section titles in the root navbar", () => {
    shellMocks.pathname = "/settings/schedule"

    render(<AppShell />)

    expect(screen.getByTestId("root-navbar-title").textContent).toBe("Schedule & Preferences")
    expect(screen.queryByTestId("chat-status-badge")).toBeNull()
  })

  test("shows the activity title in the root navbar", () => {
    shellMocks.pathname = "/activity"

    render(<AppShell />)

    expect(screen.getByTestId("root-navbar-title").textContent).toBe("Activity")
  })

  test("shows plugin detail breadcrumbs in the root navbar", () => {
    shellMocks.pathname = "/settings/plugins/canvas-mcp"

    render(<AppShell />)

    expect(screen.getByLabelText("breadcrumb")).toBeDefined()
    expect(screen.getByText("Settings")).toBeDefined()
    expect(screen.getByText("Plugins")).toBeDefined()
    expect(screen.getByText("Canvas Assistant")).toBeDefined()
    expect(screen.queryByTestId("chat-status-badge")).toBeNull()
  })

  test("hides the root navbar on onboarding", () => {
    shellMocks.pathname = "/onboarding"

    render(<AppShell />)

    expect(screen.queryByTestId("root-navbar")).toBeNull()
    expect(screen.queryByTestId("shell-sidebar-trigger")).toBeNull()
  })
})
