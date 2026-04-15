import { createRouter, createRootRoute, createRoute } from "@tanstack/react-router"
import { AppShell } from "@/components/shell/AppShell"
import { DashboardPage } from "@/pages/DashboardPage"
import { ChatPage } from "@/pages/ChatPage"
import { OnboardingPage } from "@/pages/OnboardingPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { ActivityPage } from "@/pages/ActivityPage"
import { createAppHistory } from "@/lib/routerHistory"

const rootRoute = createRootRoute({
  component: AppShell,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
})

const chatIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat",
  component: ChatPage,
})

const chatWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat/$workspaceId",
  component: ChatPage,
})

const chatThreadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat/$workspaceId/$threadId",
  component: ChatPage,
})

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
  component: OnboardingPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
})

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity",
  component: ActivityPage,
})

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  chatIndexRoute,
  chatWorkspaceRoute,
  chatThreadRoute,
  onboardingRoute,
  settingsRoute,
  activityRoute,
])

export const router = createRouter({
  routeTree,
  history: createAppHistory(),
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
