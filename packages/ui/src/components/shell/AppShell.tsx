import { Outlet } from "@tanstack/react-router"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"

export function AppShell() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  )
}
