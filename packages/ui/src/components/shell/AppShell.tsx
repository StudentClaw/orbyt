import { useRef, useCallback, useEffect } from "react"
import { Outlet, useRouterState } from "@tanstack/react-router"
import {
  useChatUiActions,
  useRuntimeChatPanelOpen,
  useRuntimeChatPanelWidth,
} from "@/hooks/useAppRuntime"
import { SidebarProvider } from "@/components/ui/sidebar"
import { ChatContainer } from "@/components/chat/ChatContainer"
import { AppSidebar } from "./AppSidebar"

const CHAT_DEFAULT_WIDTH = 33
const CHAT_MIN_WIDTH = 20
const CHAT_MAX_WIDTH = 55

export function AppShell() {
  const routerState = useRouterState()
  const chatPanelOpen = useRuntimeChatPanelOpen()
  const chatPanelWidth = useRuntimeChatPanelWidth()
  const { setPanelWidth } = useChatUiActions()

  const containerRef = useRef<HTMLDivElement>(null)
  const chatPanelRef = useRef<HTMLDivElement>(null)
  const showPanel = chatPanelOpen && routerState.location.pathname !== "/chat"

  useEffect(() => {
    if (showPanel && chatPanelRef.current) {
      chatPanelRef.current.style.width = `${chatPanelWidth}%`
    }
  }, [chatPanelWidth, showPanel])

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()

    const container = containerRef.current
    const chatPanel = chatPanelRef.current
    if (!container || !chatPanel) {
      return
    }

    const onMouseMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const newWidth = ((rect.right - ev.clientX) / rect.width) * 100
      const clamped = Math.min(CHAT_MAX_WIDTH, Math.max(CHAT_MIN_WIDTH, newWidth))
      chatPanel.style.width = `${clamped}%`
      setPanelWidth(clamped)
    }

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }, [setPanelWidth])

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div ref={containerRef} className="flex min-w-0 flex-1 overflow-hidden">
          <main className="flex-1 min-w-0 overflow-auto">
            <Outlet />
          </main>
          {showPanel && (
            <>
              <div
                className="w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/50 active:bg-primary"
                onMouseDown={startDrag}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize chat panel"
              />
              <div
                ref={chatPanelRef}
                className="h-full shrink-0 overflow-hidden"
                style={{ width: `${chatPanelWidth || CHAT_DEFAULT_WIDTH}%` }}
              >
                <ChatContainer variant="panel" />
              </div>
            </>
          )}
        </div>
      </div>
    </SidebarProvider>
  )
}
