import { isChatPath } from "@/lib/chatRoutes"

export type RootNavbarSlot = "chat-status" | null

export type RootNavbarBreadcrumb = {
  readonly label: string
}

export type RootNavbarContext =
  | {
      readonly kind: "title"
      readonly title: string
      readonly rightSlot: RootNavbarSlot
    }
  | {
      readonly kind: "breadcrumb"
      readonly breadcrumbs: readonly RootNavbarBreadcrumb[]
      readonly rightSlot: RootNavbarSlot
    }

type ResolveRootNavbarOptions = {
  readonly pathname: string
  readonly workspaceName?: string | null
  readonly threadTitle?: string | null
  readonly pluginName?: string | null
  readonly assignmentTitle?: string | null
}

export function shouldShowRootNavbar(pathname: string): boolean {
  return pathname !== "/onboarding"
}

export function extractSettingsPluginId(pathname: string): string | null {
  if (!pathname.startsWith("/plugins/") && !pathname.startsWith("/settings/plugins/")) {
    return null
  }

  const segments = pathname.split("/").filter(Boolean)
  return segments[0] === "settings" ? (segments[2] ?? null) : (segments[1] ?? null)
}

export function formatPluginLabel(pluginId: string): string {
  return pluginId
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) => {
      if (segment.toLowerCase() === "mcp") {
        return "MCP"
      }

      return segment.charAt(0).toUpperCase() + segment.slice(1)
    })
    .join(" ")
}

export function extractAssignmentId(pathname: string): string | null {
  if (!pathname.startsWith("/assignments/")) {
    return null
  }

  const segments = pathname.split("/").filter(Boolean)
  return segments[1] ?? null
}

export function resolveRootNavbarContext({
  pathname,
  workspaceName = null,
  threadTitle = null,
  pluginName = null,
  assignmentTitle = null,
}: ResolveRootNavbarOptions): RootNavbarContext | null {
  if (!shouldShowRootNavbar(pathname)) {
    return null
  }

  if (pathname === "/") {
    return { kind: "title", title: "Dashboard", rightSlot: null }
  }

  if (pathname === "/activity") {
    return { kind: "title", title: "Activity", rightSlot: null }
  }

  if (pathname === "/settings") {
    return { kind: "title", title: "General", rightSlot: null }
  }

  if (pathname === "/settings/study-profile") {
    return { kind: "title", title: "Study Profile", rightSlot: null }
  }

  if (pathname === "/plugins" || pathname === "/settings/plugins") {
    return { kind: "title", title: "Plugins", rightSlot: null }
  }

  if (pathname === "/settings/notifications") {
    return { kind: "title", title: "Notifications", rightSlot: null }
  }

  const pluginId = extractSettingsPluginId(pathname)
  if (pluginId) {
    return {
      kind: "breadcrumb",
      breadcrumbs: [
        { label: "Plugins" },
        { label: pluginName ?? formatPluginLabel(pluginId) },
      ],
      rightSlot: null,
    }
  }

  if (isChatPath(pathname)) {
    const breadcrumbs: RootNavbarBreadcrumb[] = [{ label: "Chat" }]

    if (workspaceName) {
      breadcrumbs.push({ label: workspaceName })
    }

    if (threadTitle) {
      breadcrumbs.push({ label: threadTitle })
    }

    return {
      kind: "breadcrumb",
      breadcrumbs,
      rightSlot: "chat-status",
    }
  }

  const assignmentId = extractAssignmentId(pathname)
  if (assignmentId) {
    return {
      kind: "breadcrumb",
      breadcrumbs: [
        { label: "Assignments" },
        { label: assignmentTitle ?? "Assignment" },
      ],
      rightSlot: null,
    }
  }

  return null
}
