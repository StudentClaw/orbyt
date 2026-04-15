import { useEffect, useMemo, useRef, useState } from "react"
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router"
import {
  useIsOnboardingComplete,
  useIsServerHydrationComplete,
  useRuntimeConnectionStatus,
  useRuntimeOrchestrationSnapshot,
} from "@/hooks/useAppRuntime"
import { ChatStatusBadge } from "@/components/chat/ChatStatusBadge"
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
import { isChatPath, resolveChatRouteSelection } from "@/lib/chatRoutes"
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
  const { isMobile, open, openMobile } = useSidebar()
  const sidebarPanelRef = useRef<PanelImperativeHandle | null>(null)
  const [desktopSidebarWidth, setDesktopSidebarWidth] = useState(readDesktopSidebarWidth)
  const chromeLabel = isMobile
    ? openMobile ? "Hide sidebar" : "Show sidebar"
    : open ? "Hide sidebar" : "Show sidebar"

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
      <div className="flex h-full w-full min-h-0">
        <AppSidebar />
        <ShellMain chromeLabel={chromeLabel} />
      </div>
    )
  }

  return (
    <ResizablePanelGroup className="h-full w-full min-h-0" orientation="horizontal">
      <ResizablePanel
        panelRef={sidebarPanelRef}
        id="app-shell-sidebar"
        collapsible
        collapsedSize={0}
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
          className="flex h-full min-h-0 flex-col border-r bg-sidebar text-sidebar-foreground"
          data-testid="desktop-sidebar"
        >
          {open ? <AppSidebarContent /> : null}
        </aside>
      </ResizablePanel>
      <ResizableHandle
        withHandle
        disabled={!open}
        className={!open ? "hidden" : "transition-colors hover:bg-sidebar-accent"}
      />
      <ResizablePanel id="app-shell-main" minSize={0}>
        <ShellMain chromeLabel={chromeLabel} />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

function ShellMain({ chromeLabel }: { chromeLabel: string }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const snapshot = useRuntimeOrchestrationSnapshot()
  const connectionStatus = useRuntimeConnectionStatus()
  const chatSelection = resolveChatRouteSelection(pathname)
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
  const showChatStatus = isChatPath(pathname)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur">
        <SidebarTrigger aria-label={chromeLabel} data-testid="shell-sidebar-trigger" />
        {isChatPath(pathname) ? (
          <ChatBreadcrumb
            workspaceName={currentWorkspace?.name ?? null}
            threadTitle={currentThread?.title ?? null}
          />
        ) : null}
        {showChatStatus ? <ChatStatusBadge className="ml-auto" status={chatState.status} /> : null}
      </div>
      <main className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function ChatBreadcrumb({
  workspaceName,
  threadTitle,
}: {
  workspaceName: string | null
  threadTitle: string | null
}) {
  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="min-w-0 flex-nowrap overflow-hidden">
        <BreadcrumbItem className="shrink-0 text-sm text-muted-foreground">
          <span>Chat</span>
        </BreadcrumbItem>
        {workspaceName ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0 shrink">
              {threadTitle ? (
                <span className="truncate text-sm text-muted-foreground">{workspaceName}</span>
              ) : (
                <BreadcrumbPage className="truncate text-sm">{workspaceName}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </>
        ) : null}
        {threadTitle ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0 shrink">
              <BreadcrumbPage className="truncate text-sm">{threadTitle}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
