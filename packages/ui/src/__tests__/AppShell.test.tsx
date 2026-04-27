import { describe, test, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { OrchestrationSnapshot } from "@orbyt/contracts"
import type { WsConnectionStatus } from "../rpc/wsConnectionState"

const { shellMocks, mockRouter } = vi.hoisted(() => {
  type HistoryNotify = (event: { action?: { type?: string } }) => void

  const shellMocks = {
    pathname: "/",
    navigateFn: vi.fn(),
    onboardingComplete: true,
    isMobile: false,
    pluginName: "Canvas Assistant",
    assignmentTitle: null as string | null,
    snapshot: null as OrchestrationSnapshot | null,
    connectionStatus: {
      phase: "connected",
      wsUrl: "ws://127.0.0.1:8787",
      lastSequence: 0,
      lastError: null,
    } as WsConnectionStatus,
    canGoBack: false,
    historyBack: vi.fn(),
    historyForward: vi.fn(),
    historySubscribe: vi.fn<(cb: HistoryNotify) => () => void>(() => () => {}),
    historyIndex: 0,
  }
  const mockRouter = {
    history: {
      back: () => shellMocks.historyBack(),
      forward: () => shellMocks.historyForward(),
      subscribe: (cb: HistoryNotify) => shellMocks.historySubscribe(cb),
      get location() {
        return { state: { __TSR_index: shellMocks.historyIndex } }
      },
    },
  }
  return { shellMocks, mockRouter }
})

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
  useCanGoBack: () => shellMocks.canGoBack,
  useRouter: () => mockRouter,
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

vi.mock("../rpc/assignmentDetailState", () => ({
  useAssignmentDisplayTitle: () => shellMocks.assignmentTitle,
}))

import { AppShell } from "../components/shell/AppShell"

describe("AppShell", () => {
  beforeEach(() => {
    shellMocks.pathname = "/"
    shellMocks.navigateFn.mockReset()
    shellMocks.onboardingComplete = true
    shellMocks.isMobile = false
    shellMocks.pluginName = "Canvas Assistant"
    shellMocks.assignmentTitle = null
    shellMocks.snapshot = null
    shellMocks.connectionStatus = {
      phase: "connected",
      wsUrl: "ws://127.0.0.1:8787",
      lastSequence: 0,
      lastError: null,
    }
    shellMocks.canGoBack = false
    shellMocks.historyBack.mockReset()
    shellMocks.historyForward.mockReset()
    shellMocks.historySubscribe.mockReset()
    shellMocks.historySubscribe.mockImplementation(() => () => {})
    shellMocks.historyIndex = 0
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
      chatSendReady: true,
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

  test("shows settings section titles in the root navbar", () => {
    shellMocks.pathname = "/settings/study-profile"

    render(<AppShell />)

    expect(screen.getByTestId("root-navbar-title").textContent).toBe("Study Profile")
    expect(screen.queryByTestId("chat-status-badge")).toBeNull()
  })

  test("shows a preparing chat badge while the provider is still warming", () => {
    shellMocks.pathname = "/chat"
    shellMocks.snapshot = {
      workspaces: [],
      threads: [],
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
      chatSendReady: false,
      ready: true,
      lastSequence: 1,
    }

    render(<AppShell />)

    expect(screen.getByTestId("chat-status-badge").textContent).toContain("Preparing")
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

  test("shows assignment breadcrumbs in the root navbar", () => {
    shellMocks.pathname = "/assignments/canvas-coursework:assignment:19737:540935"
    shellMocks.assignmentTitle = "Final Paper"

    render(<AppShell />)

    expect(screen.getByLabelText("breadcrumb")).toBeDefined()
    expect(screen.getByText("Assignments")).toBeDefined()
    expect(screen.getByText("Final Paper")).toBeDefined()
  })

  test("renders disabled back and forward buttons by default", () => {
    render(<AppShell />)

    const back = screen.getByTestId("shell-nav-back") as HTMLButtonElement
    const forward = screen.getByTestId("shell-nav-forward") as HTMLButtonElement
    expect(back.disabled).toBe(true)
    expect(forward.disabled).toBe(true)
  })

  test("back button invokes router history when enabled", async () => {
    const user = userEvent.setup()
    shellMocks.canGoBack = true

    render(<AppShell />)

    await user.click(screen.getByTestId("shell-nav-back"))
    expect(shellMocks.historyBack).toHaveBeenCalledTimes(1)
  })

  test("forward button becomes enabled after going back and invokes history", async () => {
    const user = userEvent.setup()
    let notify: (event: { action?: { type?: string } }) => void = () => {}
    shellMocks.historySubscribe.mockImplementation((cb) => {
      notify = cb
      return () => {}
    })
    shellMocks.historyIndex = 2

    render(<AppShell />)

    expect((screen.getByTestId("shell-nav-forward") as HTMLButtonElement).disabled).toBe(true)

    shellMocks.historyIndex = 1
    notify({ action: { type: "GO" } })

    const forward = await screen.findByTestId("shell-nav-forward")
    expect((forward as HTMLButtonElement).disabled).toBe(false)

    await user.click(forward)
    expect(shellMocks.historyForward).toHaveBeenCalledTimes(1)
  })

  test("hides the root navbar on onboarding", () => {
    shellMocks.pathname = "/onboarding"

    render(<AppShell />)

    expect(screen.queryByTestId("root-navbar")).toBeNull()
    expect(screen.queryByTestId("shell-sidebar-trigger")).toBeNull()
  })

  test("keeps the chat badge ready during background spare-runtime warmup", () => {
    shellMocks.pathname = "/chat"
    shellMocks.snapshot = {
      workspaces: [],
      threads: [],
      turns: [],
      pendingApprovals: [],
      providerStatus: "initializing",
      providerRuntime: {
        adapter: "codex",
        status: "initializing",
        authState: "authenticated",
        lastError: null,
        queuedTurnCount: 0,
        lastUpdatedAt: "2026-04-09T00:00:00.000Z",
      },
      chatSendReady: true,
      ready: true,
      lastSequence: 1,
    }

    render(<AppShell />)

    expect(screen.getByTestId("chat-status-badge").textContent).toContain("Ready")
  })
})
