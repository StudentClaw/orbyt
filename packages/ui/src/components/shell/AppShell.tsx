import { useRef, useCallback, useEffect } from "react"
import { Outlet } from "@tanstack/react-router"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import { ChatContainer } from "@/components/chat/ChatContainer"
import { useChatStore } from "@/stores/chatStore"

const CHAT_DEFAULT_WIDTH = 33 // percent
const CHAT_MIN_WIDTH = 20
const CHAT_MAX_WIDTH = 55

export function AppShell() {
  const chatPanelOpen = useChatStore((s) => s.chatPanelOpen)
  const containerRef = useRef<HTMLDivElement>(null)
  const chatPanelRef = useRef<HTMLDivElement>(null)
  const lastWidthRef = useRef(CHAT_DEFAULT_WIDTH) // remember size across open/close

  // Apply stored width when panel opens
  useEffect(() => {
    if (chatPanelOpen && chatPanelRef.current) {
      chatPanelRef.current.style.width = `${lastWidthRef.current}%`
    }
  }, [chatPanelOpen])

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()

    const container = containerRef.current
    const chatPanel = chatPanelRef.current
    if (!container || !chatPanel) return

    const onMouseMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const newWidth = ((rect.right - ev.clientX) / rect.width) * 100
      const clamped = Math.min(CHAT_MAX_WIDTH, Math.max(CHAT_MIN_WIDTH, newWidth))
      chatPanel.style.width = `${clamped}%`
      lastWidthRef.current = clamped
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
  }, [])

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div ref={containerRef} className="flex flex-1 overflow-hidden min-w-0">
          <main className="flex-1 overflow-auto min-w-0">
            <Outlet />
          </main>
          {chatPanelOpen && (
            <>
              {/* Drag handle */}
              <div
                className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-primary/50 active:bg-primary transition-colors"
                onMouseDown={startDrag}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize chat panel"
              />
              {/* Chat panel */}
              <div
                ref={chatPanelRef}
                className="h-full shrink-0 overflow-hidden"
                style={{ width: `${CHAT_DEFAULT_WIDTH}%` }}
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
