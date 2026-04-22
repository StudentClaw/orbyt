import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router"
import {
  useIsOnboardingComplete,
  useRuntimeBootstrap,
  useIsServerHydrationComplete,
  useRuntimeConnectionStatus,
  useRuntimeOrchestrationSnapshot,
} from "@/hooks/useAppRuntime"
import { ChatStatusBadge } from "@/components/chat/ChatStatusBadge"
import { usePluginDisplayName } from "@/hooks/usePluginRegistry"
import { useNativeNotification } from "@/hooks/useNativeNotification"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  readDesktopSidebarWidth,
  persistDesktopSidebarWidth,
  MIN_DESKTOP_SIDEBAR_WIDTH,
  MAX_DESKTOP_SIDEBAR_WIDTH,
} from "@/lib/sidebarLayout"
import { resolveChatState, resolveCurrentThread, resolveCurrentWorkspace } from "@/hooks/chat-model"
import { resolveChatRouteSelection } from "@/lib/chatRoutes"
import {
  extractAssignmentId,
  extractSettingsPluginId,
  resolveRootNavbarContext,
  shouldShowRootNavbar,
  type RootNavbarContext,
} from "@/lib/rootNavbar"
import { useAssignmentDisplayTitle } from "@/rpc/assignmentDetailState"
import type { PanelImperativeHandle } from "react-resizable-panels"
import { AppSidebar, AppSidebarContent } from "./AppSidebar"

export function AppShell() {
  const routerState = useRouterState()
  const onboardingComplete = useIsOnboardingComplete()
  const hydrationComplete = useIsServerHydrationComplete()
  const navigate = useNavigate()
  const pathname = routerState.location.pathname

  useNativeNotification()

  useEffect(() => {
    if (!hydrationComplete) return
    if (!onboardingComplete && pathname !== "/onboarding") {
      void navigate({ to: "/onboarding" })
    }
  }, [hydrationComplete, onboardingComplete, pathname, navigate])

  return (
    <SidebarProvider>
      <AppShellLayout />
    </SidebarProvider>
  )
}

function AppShellLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { isMobile, open, openMobile } = useSidebar()
  const sidebarPanelRef = useRef<PanelImperativeHandle | null>(null)
  const [desktopSidebarWidth, setDesktopSidebarWidth] = useState(readDesktopSidebarWidth)
  const sidebarLabel = isMobile
    ? openMobile ? "Hide sidebar" : "Show sidebar"
    : open ? "Hide sidebar" : "Show sidebar"
  const showNavbar = shouldShowRootNavbar(pathname)

  useEffect(() => {
    if (isMobile) {
      return
    }

    if (open) {
      sidebarPanelRef.current?.expand()
      return
    }

    sidebarPanelRef.current?.collapse()
  }, [isMobile, open])

  if (isMobile) {
    return (
      <div className="flex h-full w-full min-h-0 flex-col">
        {showNavbar ? <RootNavbar sidebarLabel={sidebarLabel} /> : null}
        <div className="flex min-h-0 flex-1">
          <AppSidebar />
          <ShellMain />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col">
      {showNavbar ? <RootNavbar sidebarLabel={sidebarLabel} /> : null}
      <ResizablePanelGroup className="min-h-0 flex-1" orientation="horizontal">
        <ResizablePanel
          panelRef={sidebarPanelRef}
          id="app-shell-sidebar"
          collapsible
          collapsedSize={48}
          defaultSize={desktopSidebarWidth}
          minSize={MIN_DESKTOP_SIDEBAR_WIDTH}
          maxSize={MAX_DESKTOP_SIDEBAR_WIDTH}
          groupResizeBehavior="preserve-pixel-size"
          className="min-w-0"
          onResize={(panelSize) => {
            if (panelSize.inPixels <= 0) {
              return
            }

            setDesktopSidebarWidth(persistDesktopSidebarWidth(panelSize.inPixels))
          }}
        >
          <aside
            className="group flex h-full min-h-0 flex-col border-r bg-sidebar text-sidebar-foreground"
            data-state={open ? "expanded" : "collapsed"}
            data-collapsible={open ? "" : "icon"}
            data-testid="desktop-sidebar"
          >
            <AppSidebarContent />
          </aside>
        </ResizablePanel>
        <ResizableHandle
          withHandle
          disabled={!open}
          className={!open ? "hidden" : "transition-colors hover:bg-sidebar-accent"}
        />
        <ResizablePanel id="app-shell-main" minSize={0}>
          <ShellMain />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

function RootNavbar({ sidebarLabel }: { sidebarLabel: string }) {
  const { isMobile } = useSidebar()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const bootstrap = useRuntimeBootstrap()
  const snapshot = useRuntimeOrchestrationSnapshot()
  const connectionStatus = useRuntimeConnectionStatus()
  const chatSelection = resolveChatRouteSelection(pathname)
  const pluginId = extractSettingsPluginId(pathname)
  const assignmentId = extractAssignmentId(pathname)
  const assignmentTitle = useAssignmentDisplayTitle(assignmentId)
  const currentThread = useMemo(
    () => resolveCurrentThread(snapshot, chatSelection.threadId),
    [chatSelection.threadId, snapshot],
  )
  const currentWorkspace = useMemo(
    () => resolveCurrentWorkspace(snapshot, chatSelection.workspaceId, chatSelection.threadId),
    [chatSelection.threadId, chatSelection.workspaceId, snapshot],
  )
  const chatState = useMemo(
    () => resolveChatState(snapshot, currentThread, connectionStatus),
    [connectionStatus, currentThread, snapshot],
  )
  const pluginName = usePluginDisplayName(pluginId, Boolean(pluginId && bootstrap?.featureFlags.pluginSystem))
  const navbarContext = useMemo(
    () => resolveRootNavbarContext({
      pathname,
      workspaceName: currentWorkspace?.name ?? null,
      threadTitle: currentThread?.title ?? null,
      pluginName,
      assignmentTitle,
    }),
    [assignmentTitle, currentThread?.title, currentWorkspace?.name, pathname, pluginName],
  )

  if (!navbarContext) {
    return null
  }

  return (
    <header
      className={
        isMobile
          ? "window-drag flex h-12 shrink-0 items-center border-b bg-background/95 px-3 backdrop-blur"
          : "window-drag flex h-12 shrink-0 items-center border-b bg-background/95 pr-3 pl-20 backdrop-blur"
      }
      data-testid="root-navbar"
    >
      <div className="window-no-drag flex w-10 shrink-0 items-center justify-center">
        <SidebarTrigger
          aria-label={sidebarLabel}
          data-testid="shell-sidebar-trigger"
          className="h-8 w-8 shrink-0"
        />
      </div>
      <div className="ml-2 min-w-0 flex-1">
        <NavbarContextView context={navbarContext} />
      </div>
      {navbarContext.rightSlot === "chat-status" ? (
        <ChatStatusBadge className="window-no-drag ml-3" status={chatState.status} />
      ) : null}
    </header>
  )
}

function ShellMain() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <main className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function NavbarContextView({ context }: { context: RootNavbarContext }) {
  if (context.kind === "title") {
    return (
      <h1
        className="truncate text-base font-semibold tracking-tight"
        data-testid="root-navbar-title"
      >
        {context.title}
      </h1>
    )
  }

  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="min-w-0 flex-nowrap overflow-hidden">
        {context.breadcrumbs.map((item, index) => {
          const isLast = index === context.breadcrumbs.length - 1

          return (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem
                className={isLast ? "min-w-0 shrink" : "shrink-0 text-sm text-muted-foreground"}
              >
                {isLast ? (
                  <BreadcrumbPage className="truncate text-sm">{item.label}</BreadcrumbPage>
                ) : (
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
