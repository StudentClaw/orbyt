import { Link, useRouterState } from "@tanstack/react-router"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  AiChat02Icon,
  DashboardSquare01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"
import { useRuntimeActivityUnreadCount } from "@/hooks/useAppRuntime"
import { isChatPath } from "@/lib/chatRoutes"
import { ChatHistory } from "./ChatHistory"
import { ConnectionStatus } from "./ConnectionStatus"

const navItems = [
  { label: "Dashboard", path: "/", icon: DashboardSquare01Icon },
  { label: "Chat", path: "/chat", icon: AiChat02Icon },
  { label: "Activity", path: "/activity", icon: Activity01Icon },
  { label: "Settings", path: "/settings", icon: Settings01Icon },
] as const

export function AppSidebar() {
  return (
    <Sidebar>
      <AppSidebarContent />
    </Sidebar>
  )
}

export function AppSidebarContent() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const activityUnreadCount = useRuntimeActivityUnreadCount()
  const { isMobile, open, openMobile } = useSidebar()
  const sidebarOpen = isMobile ? openMobile : open
  const triggerLabel = isMobile
    ? openMobile ? "Hide sidebar" : "Show sidebar"
    : open ? "Hide sidebar" : "Show sidebar"

  return (
    <>
      <SidebarHeader className={sidebarOpen ? "p-4 pb-2" : "items-center p-2 pt-3"}>
        <div className={sidebarOpen ? "flex items-center justify-between gap-3" : "flex justify-center"}>
          {sidebarOpen && <h2 className="text-lg font-semibold">Student Claw</h2>}
          <SidebarTrigger
            aria-label={triggerLabel}
            data-testid={!isMobile ? "shell-sidebar-trigger" : undefined}
            className="h-8 w-8 shrink-0"
          />
        </div>
        <SidebarMenu className={sidebarOpen ? "" : "items-center"}>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton
                asChild
                tooltip={item.label}
                isActive={item.path === "/chat" ? isChatPath(currentPath) : currentPath === item.path}
              >
                <Link to={item.path}>
                  <HugeiconsIcon icon={item.icon} size={18} />
                  <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                </Link>
              </SidebarMenuButton>
              {item.path === "/activity" && activityUnreadCount > 0 && (
                <SidebarMenuBadge data-testid="activity-badge">
                  {activityUnreadCount > 99 ? "99+" : activityUnreadCount}
                </SidebarMenuBadge>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarHeader>
      {sidebarOpen && (
        <>
          <SidebarContent>
            <ChatHistory />
          </SidebarContent>
          <SidebarFooter className="p-4">
            <ConnectionStatus />
          </SidebarFooter>
        </>
      )}
    </>
  )
}
