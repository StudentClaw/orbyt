import { Link, useRouterState } from "@tanstack/react-router"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons"
import { useRuntimeActivityUnreadCount } from "@/hooks/useAppRuntime"
import { useTheme } from "@/hooks/useTheme"
import { isChatPath } from "@/lib/chatRoutes"
import { ChatHistory } from "./ChatHistory"
import { ConnectionStatus } from "./ConnectionStatus"

const navItems = [
  { label: "Dashboard", path: "/" },
  { label: "Chat", path: "/chat" },
  { label: "Activity", path: "/activity" },
  { label: "Settings", path: "/settings" },
] as const

export function AppSidebar() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const activityUnreadCount = useRuntimeActivityUnreadCount()
  const { theme, toggleTheme } = useTheme()

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <h2 className="text-lg font-semibold">Student Claw</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton
                asChild
                isActive={item.path === "/chat" ? isChatPath(currentPath) : currentPath === item.path}
              >
                <Link to={item.path}>
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
        <SidebarSeparator />
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
    </Sidebar>
  )
}
