import { Link, useRouterState } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  DashboardSquare01Icon,
  PuzzleIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"
import { useRuntimeActivityUnreadCount } from "@/hooks/useAppRuntime"
import { ChatHistory } from "./ChatHistory"
import { ConnectionStatus } from "./ConnectionStatus"

const sidebarBrandIcon = new URL("../../../public/favicon.svg", import.meta.url).href

const navItems = [
  { label: "Dashboard", path: "/", icon: DashboardSquare01Icon },
  { label: "Activity", path: "/activity", icon: Activity01Icon },
  { label: "Plugins", path: "/plugins", icon: PuzzleIcon },
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

  return (
    <>
      <SidebarHeader className={sidebarOpen ? "px-3 pb-3 pt-4" : "px-2 pb-3 pt-4"}>
        <div className={sidebarOpen ? "flex items-center gap-3" : "flex justify-center"}>
          <img
            src={sidebarBrandIcon}
            alt=""
            aria-hidden="true"
            className={sidebarOpen ? "h-8 w-8 shrink-0" : "h-9 w-9 shrink-0"}
            data-testid="sidebar-brand-icon"
          />
          {sidebarOpen ? (
            <h2
              className="truncate text-lg font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-brand)" }}
            >
              Orybt
            </h2>
          ) : null}
        </div>
        <SidebarMenu className={sidebarOpen ? "window-no-drag mt-4" : "window-no-drag mt-2 items-center"}>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton
                asChild
                tooltip={item.label}
                isActive={item.path === "/" ? currentPath === item.path : currentPath.startsWith(item.path)}
              >
                <Link to={item.path} data-testid={item.path === "/plugins" ? "sidebar-plugins-link" : undefined}>
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
      <>
        {sidebarOpen ? (
          <SidebarContent>
            <ChatHistory />
          </SidebarContent>
        ) : null}
        <SidebarFooter
          className={
            sidebarOpen
              ? "window-no-drag mt-auto border-t border-sidebar-border/70 p-3"
              : "window-no-drag mt-auto px-2 py-3"
          }
        >
          <div className={sidebarOpen ? "flex items-center justify-between gap-3" : "flex justify-center"}>
            {sidebarOpen ? <ConnectionStatus /> : null}
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              aria-label="Settings"
              className="shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Link to="/settings" data-testid="sidebar-settings-link">
                <HugeiconsIcon icon={Settings01Icon} size={18} />
              </Link>
            </Button>
          </div>
        </SidebarFooter>
      </>
    </>
  )
}
