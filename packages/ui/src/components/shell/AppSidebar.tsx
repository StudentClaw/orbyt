import { Link, useRouterState } from "@tanstack/react-router"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { ChatSheet } from "./ChatSheet"
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

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <h2 className="text-lg font-semibold">Student Claw</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton asChild isActive={currentPath === item.path}>
                <Link to={item.path}>{item.label}</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <div className="mt-4 px-2">
          <ChatSheet />
        </div>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <ConnectionStatus />
      </SidebarFooter>
    </Sidebar>
  )
}
