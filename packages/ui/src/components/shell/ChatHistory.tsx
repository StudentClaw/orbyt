import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  FolderAddIcon,
  Message01Icon,
} from "@hugeicons/core-free-icons"
import { IpcChannel } from "@student-claw/contracts"
import {
  useChatUiActions,
  useOrchestrationActions,
  useRuntimeConnectionStatus,
  useRuntimeOrchestrationSnapshot,
  useRuntimeSelectedThreadId,
  useRuntimeSelectedWorkspaceId,
} from "@/hooks/useAppRuntime"
import { sortThreadsByRecency } from "@/hooks/chat-model"
import { isChatPath, resolveChatRouteSelection } from "@/lib/chatRoutes"
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

const COLLAPSED_WORKSPACE_STORAGE_KEY = "student-claw:chat-collapsed-workspaces"

function readCollapsedWorkspaceIds(): Set<string> {
  if (typeof window === "undefined") {
    return new Set()
  }

  try {
    const raw = window.localStorage.getItem(COLLAPSED_WORKSPACE_STORAGE_KEY)
    if (!raw) {
      return new Set()
    }

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.filter((value): value is string => typeof value === "string")) : new Set()
  } catch {
    return new Set()
  }
}

function persistCollapsedWorkspaceIds(ids: Set<string>): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(
      COLLAPSED_WORKSPACE_STORAGE_KEY,
      JSON.stringify([...ids]),
    )
  } catch {
    // Ignore localStorage failures to avoid breaking the sidebar.
  }
}

export function ChatHistory() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navigate = useNavigate()
  const snapshot = useRuntimeOrchestrationSnapshot()
  const selectedWorkspaceId = useRuntimeSelectedWorkspaceId()
  const selectedThreadId = useRuntimeSelectedThreadId()
  const connectionStatus = useRuntimeConnectionStatus()
  const {
    createWorkspace,
    relinkWorkspace,
    deleteWorkspace,
    createThread,
  } = useOrchestrationActions()
  const { openPanel, selectWorkspace, selectChatTarget, clearSelection } = useChatUiActions()
  const [collapsedWorkspaceIds, setCollapsedWorkspaceIds] = useState<Set<string>>(readCollapsedWorkspaceIds)
  const [busyWorkspaceId, setBusyWorkspaceId] = useState<string | null>(null)
  const [addingFolder, setAddingFolder] = useState(false)

  const routeSelection = resolveChatRouteSelection(pathname)
  const isOnChatRoute = isChatPath(pathname)
  const effectiveSelection = isOnChatRoute
    ? routeSelection
    : {
        workspaceId: selectedWorkspaceId,
        threadId: selectedThreadId,
      }

  const workspaces = useMemo(() => {
    return [...(snapshot?.workspaces ?? [])].sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "filesystem" ? -1 : 1
      }
      return left.name.localeCompare(right.name)
    })
  }, [snapshot?.workspaces])

  const threadsByWorkspaceId = useMemo(() => {
    const grouped = new Map<string, ReturnType<typeof sortThreadsByRecency>>()
    for (const workspace of workspaces) {
      grouped.set(
        workspace.id,
        sortThreadsByRecency((snapshot?.threads ?? []).filter((thread) => thread.workspaceId === workspace.id)),
      )
    }
    return grouped
  }, [snapshot?.threads, workspaces])

  useEffect(() => {
    setCollapsedWorkspaceIds((current) => {
      const validIds = new Set<string>(workspaces.map((workspace) => workspace.id))
      const next = new Set([...current].filter((id) => validIds.has(id)))
      if (next.size === current.size && [...next].every((id) => current.has(id))) {
        return current
      }
      persistCollapsedWorkspaceIds(next)
      return next
    })
  }, [workspaces])

  const setCollapsedIds = useCallback((next: Set<string>) => {
    persistCollapsedWorkspaceIds(next)
    setCollapsedWorkspaceIds(next)
  }, [])

  const toggleWorkspaceExpanded = useCallback((workspaceId: string) => {
    setCollapsedIds((() => {
      const next = new Set(collapsedWorkspaceIds)
      if (next.has(workspaceId)) {
        next.delete(workspaceId)
      } else {
        next.add(workspaceId)
      }
      return next
    })())
  }, [collapsedWorkspaceIds, setCollapsedIds])

  const pickFolder = useCallback(async (): Promise<string | null> => {
    const result = await window.electronAPI?.invoke(IpcChannel.FILE_OPEN_DIALOG, {
      directory: true,
    }).catch(() => null)

    return typeof result === "string" ? result : null
  }, [])

  const focusWorkspace = useCallback(async (workspaceId: string) => {
    if (isOnChatRoute) {
      await navigate({
        to: "/chat/$workspaceId",
        params: { workspaceId },
      })
      return
    }

    selectWorkspace(workspaceId)
    openPanel()
  }, [isOnChatRoute, navigate, openPanel, selectWorkspace])

  const focusThread = useCallback(async (workspaceId: string, threadId: string) => {
    if (isOnChatRoute) {
      await navigate({
        to: "/chat/$workspaceId/$threadId",
        params: { workspaceId, threadId },
      })
      return
    }

    selectChatTarget(workspaceId, threadId)
    openPanel()
  }, [isOnChatRoute, navigate, openPanel, selectChatTarget])

  const handleCreateThread = useCallback(async (workspaceId: string, seedTitle = "New chat") => {
    const threadId = await createThread(workspaceId, seedTitle)
    await focusThread(workspaceId, threadId)
  }, [createThread, focusThread])

  const handleAddFolder = useCallback(async () => {
    const pickedPath = await pickFolder()
    if (!pickedPath) {
      return
    }

    setAddingFolder(true)
    try {
      const workspaceId = await createWorkspace(pickedPath)
      const existedAlready = snapshot?.workspaces.some((workspace) => workspace.id === workspaceId) ?? false

      if (existedAlready) {
        await focusWorkspace(workspaceId)
        return
      }

      await handleCreateThread(workspaceId, "New chat")
    } finally {
      setAddingFolder(false)
    }
  }, [createWorkspace, focusWorkspace, handleCreateThread, pickFolder, snapshot?.workspaces])

  const handleRelinkWorkspace = useCallback(async (workspaceId: string) => {
    const pickedPath = await pickFolder()
    if (!pickedPath) {
      return
    }

    setBusyWorkspaceId(workspaceId)
    try {
      await relinkWorkspace(workspaceId, pickedPath)
      if (effectiveSelection.workspaceId === workspaceId && isOnChatRoute) {
        await navigate({
          to: effectiveSelection.threadId
            ? "/chat/$workspaceId/$threadId"
            : "/chat/$workspaceId",
          params: effectiveSelection.threadId
            ? { workspaceId, threadId: effectiveSelection.threadId }
            : { workspaceId },
        })
      }
    } finally {
      setBusyWorkspaceId(null)
    }
  }, [
    effectiveSelection.threadId,
    effectiveSelection.workspaceId,
    isOnChatRoute,
    navigate,
    pickFolder,
    relinkWorkspace,
  ])

  const handleDeleteWorkspace = useCallback(async (workspaceId: string) => {
    setBusyWorkspaceId(workspaceId)
    try {
      await deleteWorkspace(workspaceId)
      if (effectiveSelection.workspaceId === workspaceId) {
        if (isOnChatRoute) {
          await navigate({ to: "/chat" })
        } else {
          clearSelection()
        }
      }
    } finally {
      setBusyWorkspaceId(null)
    }
  }, [clearSelection, deleteWorkspace, effectiveSelection.workspaceId, isOnChatRoute, navigate])

  const handleWorkspaceClick = useCallback(async (workspaceId: string) => {
    await focusWorkspace(workspaceId)
  }, [focusWorkspace])

  const canCreateChat = connectionStatus.phase === "connected"

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Folders</SidebarGroupLabel>
      <SidebarGroupAction
        title="Add folder"
        onClick={() => void handleAddFolder()}
        disabled={addingFolder}
        className="top-3 right-2 h-8 w-8 rounded-full border border-sidebar-border/60 bg-sidebar/80 text-sidebar-foreground shadow-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <HugeiconsIcon icon={FolderAddIcon} size={18} />
        <span className="sr-only">Add folder</span>
      </SidebarGroupAction>
      <SidebarGroupContent>
        {workspaces.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">No folders yet</p>
        ) : (
          <div className="space-y-2">
            {workspaces.map((workspace) => {
              const workspaceThreads = threadsByWorkspaceId.get(workspace.id) ?? []
              const isCollapsed = collapsedWorkspaceIds.has(workspace.id)
              const isWorkspaceActive =
                effectiveSelection.workspaceId === workspace.id && effectiveSelection.threadId === null
              const isWorkspaceMissing =
                workspace.kind === "filesystem" && workspace.availability === "missing"
              const isWorkspaceBusy = busyWorkspaceId === workspace.id

              return (
                <div key={workspace.id} className="rounded-md border border-transparent">
                  <div className="flex items-start gap-1 px-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 px-0 text-xs"
                      onClick={() => toggleWorkspaceExpanded(workspace.id)}
                      aria-label={isCollapsed ? `Expand ${workspace.name}` : `Collapse ${workspace.name}`}
                    >
                      {isCollapsed ? ">" : "v"}
                    </Button>
                    <button
                      type="button"
                      title={workspace.kind === "filesystem" ? workspace.rootPath : workspace.name}
                      className={`flex min-w-0 flex-1 flex-col rounded-md px-2 py-1 text-left transition-colors ${
                        isWorkspaceActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60"
                      }`}
                      onClick={() => void handleWorkspaceClick(workspace.id)}
                    >
                      <span className="truncate text-sm font-medium">{workspace.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {workspace.kind === "filesystem"
                          ? workspace.rootPath
                          : "Imported legacy chats"}
                      </span>
                      {isWorkspaceMissing && (
                        <span className="text-[11px] text-destructive">Folder missing</span>
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 px-0"
                      onClick={() => void handleCreateThread(workspace.id)}
                      disabled={!canCreateChat || isWorkspaceMissing || isWorkspaceBusy}
                      aria-label={`Add chat to ${workspace.name}`}
                    >
                      <HugeiconsIcon icon={Add01Icon} size={14} />
                    </Button>
                  </div>

                  {isWorkspaceMissing && (
                    <div className="flex gap-2 px-10 pb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => void handleRelinkWorkspace(workspace.id)}
                        disabled={isWorkspaceBusy}
                      >
                        Relink
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive hover:text-destructive"
                        onClick={() => void handleDeleteWorkspace(workspace.id)}
                        disabled={isWorkspaceBusy}
                      >
                        Remove
                      </Button>
                    </div>
                  )}

                  {!isCollapsed && (
                    <div className="pl-10 pr-2 pb-1">
                      {workspaceThreads.length === 0 ? (
                        <p className="px-2 py-1 text-xs text-muted-foreground">No chats yet</p>
                      ) : (
                        <SidebarMenu>
                          {workspaceThreads.map((thread) => (
                            <SidebarMenuItem key={thread.id}>
                              <SidebarMenuButton
                                isActive={effectiveSelection.threadId === thread.id}
                                onClick={() => void focusThread(workspace.id, thread.id)}
                                className="flex h-auto items-start gap-2 py-2"
                              >
                                <HugeiconsIcon icon={Message01Icon} size={14} className="mt-0.5 shrink-0" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate">{thread.title}</span>
                                  <span className="block text-xs text-muted-foreground">{thread.status}</span>
                                </span>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
