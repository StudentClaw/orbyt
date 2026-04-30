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
                <Link
                  to={item.path}
                  data-testid={
                    item.path === "/plugins"
                      ? "sidebar-plugins-link"
                      : item.path === "/activity"
                        ? "sidebar-activity-link"
                        : item.path === "/"
                          ? "sidebar-dashboard-link"
                          : undefined
                  }
                >
                  <HugeiconsIcon icon={item.icon} size={18} />
                  <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                </Link>
              </SidebarMenuButton>
              {item.path === "/activity" && activityUnreadCount > 0 && (
                <SidebarMenuBadge
                  data-testid="activity-badge"
                  className="right-2 !top-1/2 h-5 min-w-5 -translate-y-1/2 rounded-full bg-blue-500 px-1.5 text-[11px] font-semibold leading-none text-white shadow-sm ring-2 ring-sidebar peer-hover/menu-button:text-white peer-data-active/menu-button:text-white peer-data-[size=default]/menu-button:top-1/2 peer-data-[size=lg]/menu-button:top-1/2 peer-data-[size=sm]/menu-button:top-1/2"
                >
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
          <div className={sidebarOpen ? "flex items-center" : "flex justify-center"}>
            <Button
              asChild
              variant="ghost"
              size={sidebarOpen ? "default" : "icon-sm"}
              aria-label="Settings"
              className={
                sidebarOpen
                  ? "w-full justify-start gap-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  : "shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }
            >
              <Link to="/settings" data-testid="sidebar-settings-link">
                <HugeiconsIcon icon={Settings01Icon} size={18} />
                {sidebarOpen ? <span>Settings</span> : null}
              </Link>
            </Button>
          </div>
        </SidebarFooter>
      </>
    </>
  )
}
