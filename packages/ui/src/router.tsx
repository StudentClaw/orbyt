import { createRouter, createRootRoute, createRoute, useNavigate } from "@tanstack/react-router"
import { AppShell } from "@/components/shell/AppShell"
import { DashboardPage } from "@/pages/DashboardPage"
import { AssignmentDetailPage } from "@/pages/AssignmentDetailPage"
import { ChatPage } from "@/pages/ChatPage"
import { OnboardingPage } from "@/pages/OnboardingPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { ActivityPage } from "@/pages/ActivityPage"
import type { SettingsSection } from "@/components/settings/SettingsSidebar"
import { createAppHistory } from "@/lib/routerHistory"

const rootRoute = createRootRoute({
  component: AppShell,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
})

function AssignmentDetailRouteComponent() {
  const { assignmentId } = assignmentDetailRoute.useParams()

  return <AssignmentDetailPage assignmentId={assignmentId} />
}

const assignmentDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/assignments/$assignmentId",
  component: AssignmentDetailRouteComponent,
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

function resolveSettingsPath(
  section: SettingsSection,
): "/settings" | "/settings/study-profile" | "/settings/plugins" | "/settings/notifications" {
  switch (section) {
    case "general":
      return "/settings"
    case "study-profile":
      return "/settings/study-profile"
    case "connections":
      return "/settings/plugins"
    case "notifications":
      return "/settings/notifications"
  }
}

function SettingsGeneralRouteComponent() {
  const navigate = useNavigate()

  return (
    <SettingsPage
      activeSection="general"
      onSectionSelect={(section) => void navigate({ to: resolveSettingsPath(section) })}
      onPluginSelect={(pluginId) => void navigate({ to: "/settings/plugins/$pluginId", params: { pluginId } })}
      onPluginBack={() => void navigate({ to: "/settings/plugins" })}
    />
  )
}

function SettingsStudyProfileRouteComponent() {
  const navigate = useNavigate()

  return (
    <SettingsPage
      activeSection="study-profile"
      onSectionSelect={(section) => void navigate({ to: resolveSettingsPath(section) })}
      onPluginSelect={(pluginId) => void navigate({ to: "/settings/plugins/$pluginId", params: { pluginId } })}
      onPluginBack={() => void navigate({ to: "/settings/plugins" })}
    />
  )
}

function SettingsConnectionsRouteComponent() {
  const navigate = useNavigate()

  return (
    <SettingsPage
      activeSection="connections"
      onSectionSelect={(section) => void navigate({ to: resolveSettingsPath(section) })}
      onPluginSelect={(pluginId) => void navigate({ to: "/settings/plugins/$pluginId", params: { pluginId } })}
      onPluginBack={() => void navigate({ to: "/settings/plugins" })}
    />
  )
}

function SettingsPluginDetailRouteComponent() {
  const navigate = useNavigate()
  const { pluginId } = settingsPluginDetailRoute.useParams()

  return (
    <SettingsPage
      activeSection="connections"
      selectedPluginId={pluginId}
      onSectionSelect={(section) => void navigate({ to: resolveSettingsPath(section) })}
      onPluginSelect={(nextPluginId) => void navigate({ to: "/settings/plugins/$pluginId", params: { pluginId: nextPluginId } })}
      onPluginBack={() => void navigate({ to: "/settings/plugins" })}
    />
  )
}

function SettingsNotificationsRouteComponent() {
  const navigate = useNavigate()

  return (
    <SettingsPage
      activeSection="notifications"
      onSectionSelect={(section) => void navigate({ to: resolveSettingsPath(section) })}
      onPluginSelect={(pluginId) => void navigate({ to: "/settings/plugins/$pluginId", params: { pluginId } })}
      onPluginBack={() => void navigate({ to: "/settings/plugins" })}
    />
  )
}

const settingsGeneralRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsGeneralRouteComponent,
})

const settingsStudyProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings/study-profile",
  component: SettingsStudyProfileRouteComponent,
})

const settingsConnectionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings/plugins",
  component: SettingsConnectionsRouteComponent,
})

const settingsPluginDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings/plugins/$pluginId",
  component: SettingsPluginDetailRouteComponent,
})

const settingsNotificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings/notifications",
  component: SettingsNotificationsRouteComponent,
})

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity",
  component: ActivityPage,
})

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  assignmentDetailRoute,
  chatIndexRoute,
  chatWorkspaceRoute,
  chatThreadRoute,
  onboardingRoute,
  settingsGeneralRoute,
  settingsStudyProfileRoute,
  settingsConnectionsRoute,
  settingsPluginDetailRoute,
  settingsNotificationsRoute,
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
