export interface ChatRouteSelection {
  readonly workspaceId: string | null
  readonly threadId: string | null
}

export function isChatPath(pathname: string): boolean {
  return pathname === "/chat" || pathname.startsWith("/chat/")
}

export function resolveChatRouteSelection(pathname: string): ChatRouteSelection {
  if (!isChatPath(pathname)) {
    return {
      workspaceId: null,
      threadId: null,
    }
  }

  const segments = pathname
    .split("/")
    .filter(Boolean)
    .slice(1)

  return {
    workspaceId: segments[0] ?? null,
    threadId: segments[1] ?? null,
  }
}
