import { Link, useRouterState } from "@tanstack/react-router"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  AiChat02Icon,
  DashboardSquare01Icon,
  Moon02Icon,
  Settings01Icon,
  Sun01Icon,
} from "@hugeicons/core-free-icons"
import { useRuntimeActivityUnreadCount } from "@/hooks/useAppRuntime"
import { useTheme } from "@/hooks/useTheme"
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
  const { theme, toggleTheme } = useTheme()

  return (
    <>
      <SidebarHeader className="p-4 pb-2">
        <h2 className="text-lg font-semibold">Student Claw</h2>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton
                asChild
                isActive={item.path === "/chat" ? isChatPath(currentPath) : currentPath === item.path}
              >
                <Link to={item.path}>
                  <HugeiconsIcon icon={item.icon} size={18} />
                  {item.label}
                  {item.path === "/activity" && activityUnreadCount > 0 && (
                    <span
                      className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground"
                      data-testid="activity-badge"
                    >
                      {activityUnreadCount > 99 ? "99+" : activityUnreadCount}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <ChatHistory />
      </SidebarContent>
      <SidebarFooter className="p-4 flex flex-row items-center justify-between">
        <ConnectionStatus />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="h-8 w-8 shrink-0"
        >
          <HugeiconsIcon
            icon={theme === "dark" ? Sun01Icon : Moon02Icon}
            size={16}
          />
        </Button>
      </SidebarFooter>
    </>
  )
}
