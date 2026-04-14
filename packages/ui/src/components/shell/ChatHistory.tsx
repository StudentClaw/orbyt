import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowDown01Icon,
  Delete01Icon,
  FolderAddIcon,
  MoreHorizontalCircle01Icon,
} from "@hugeicons/core-free-icons"
import { IpcChannel } from "@student-claw/contracts"
import type { OrchestrationThread } from "@student-claw/contracts"
import {
  useOrchestrationActions,
  useRuntimeConnectionStatus,
  useRuntimeOrchestrationSnapshot,
} from "@/hooks/useAppRuntime"
import { sortThreadsByRecency } from "@/hooks/chat-model"
import { resolveChatRouteSelection } from "@/lib/chatRoutes"
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuAction,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const COLLAPSED_WORKSPACE_STORAGE_KEY = "student-claw:chat-collapsed-workspaces"
const SEEN_THREAD_TURNS_STORAGE_KEY = "student-claw:chat-seen-thread-turns"

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}

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
    window.localStorage.setItem(COLLAPSED_WORKSPACE_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // Ignore localStorage failures to avoid breaking the sidebar.
  }
}

function readSeenThreadTurns(): Map<string, string | null> {
  if (typeof window === "undefined") {
    return new Map()
  }

  try {
    const raw = window.localStorage.getItem(SEEN_THREAD_TURNS_STORAGE_KEY)
    if (!raw) {
      return new Map()
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return new Map()
    }

    return new Map(
      parsed.filter(
        (entry): entry is [string, string | null] =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === "string" &&
          (entry[1] === null || typeof entry[1] === "string"),
      ),
    )
  } catch {
    return new Map()
  }
}

function persistSeenThreadTurns(map: Map<string, string | null>): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(SEEN_THREAD_TURNS_STORAGE_KEY, JSON.stringify([...map]))
  } catch {
    // Ignore localStorage failures.
  }
}

type ThreadIndicator = "spinner" | "green-dot" | "gray-dot"

function getThreadIndicator(
  thread: OrchestrationThread,
  isSelected: boolean,
  seenThreadTurns: Map<string, string | null>,
): ThreadIndicator {
  if (thread.status === "streaming") {
    return "spinner"
  }

  if (
    !isSelected &&
    thread.currentTurnId !== null &&
    thread.currentTurnId !== seenThreadTurns.get(thread.id)
  ) {
    return "green-dot"
  }

  return "gray-dot"
}

export function ChatHistory() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navigate = useNavigate()
  const snapshot = useRuntimeOrchestrationSnapshot()
  const connectionStatus = useRuntimeConnectionStatus()
  const {
    createWorkspace,
    relinkWorkspace,
    deleteWorkspace,
    createThread,
    renameThread,
    deleteThread,
  } = useOrchestrationActions()
  const [collapsedWorkspaceIds, setCollapsedWorkspaceIds] = useState<Set<string>>(readCollapsedWorkspaceIds)
  const [seenThreadTurns, setSeenThreadTurns] = useState<Map<string, string | null>>(readSeenThreadTurns)
  const [busyWorkspaceId, setBusyWorkspaceId] = useState<string | null>(null)
  const [busyThreadId, setBusyThreadId] = useState<string | null>(null)
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [addingFolder, setAddingFolder] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const effectiveSelection = resolveChatRouteSelection(pathname)

  const workspaces = useMemo(() => {
    return [...(snapshot?.workspaces ?? [])]
      .filter((workspace) => workspace.kind === "filesystem")
      .sort((left, right) => left.name.localeCompare(right.name))
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

  const markThreadSeen = useCallback((threadId: string, currentTurnId: string | null) => {
    setSeenThreadTurns((prev) => {
      const next = new Map(prev)
      next.set(threadId, currentTurnId)
      persistSeenThreadTurns(next)
      return next
    })
  }, [])

  useEffect(() => {
    if (!effectiveSelection.threadId) {
      return
    }

    const selectedThread = snapshot?.threads.find((thread) => thread.id === effectiveSelection.threadId)
    if (!selectedThread) {
      return
    }

    markThreadSeen(selectedThread.id, selectedThread.currentTurnId)
  }, [effectiveSelection.threadId, snapshot?.threads, markThreadSeen])

  useEffect(() => {
    if (!editingThreadId) {
      return
    }

    const threadStillExists = snapshot?.threads.some((thread) => thread.id === editingThreadId) ?? false
    if (!threadStillExists) {
      setEditingThreadId(null)
      setEditingTitle("")
    }
  }, [editingThreadId, snapshot?.threads])

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
    if (!window.electronAPI?.invoke) {
      throw new Error("Adding folders is only available in the desktop app.")
    }

    const result = await window.electronAPI.invoke(IpcChannel.FILE_OPEN_DIALOG, {
      directory: true,
    })

    return typeof result === "string" ? result : null
  }, [])

  const focusWorkspace = useCallback(async (workspaceId: string) => {
    await navigate({
      to: "/chat/$workspaceId",
      params: { workspaceId },
    })
  }, [navigate])

  const focusThread = useCallback(async (workspaceId: string, threadId: string, currentTurnId?: string | null) => {
    markThreadSeen(threadId, currentTurnId ?? null)

    await navigate({
      to: "/chat/$workspaceId/$threadId",
      params: { workspaceId, threadId },
    })
  }, [markThreadSeen, navigate])

  const handleCreateThread = useCallback(async (workspaceId: string, seedTitle = "New chat") => {
    const threadId = await createThread(workspaceId, seedTitle)
    await focusThread(workspaceId, threadId, null)
  }, [createThread, focusThread])

  const handleAddFolder = useCallback(async () => {
    setActionError(null)

    let pickedPath: string | null
    try {
      pickedPath = await pickFolder()
    } catch (error) {
      setActionError(
        getErrorMessage(error, "Failed to open the folder picker. Restart the desktop app and try again."),
      )
      return
    }

    if (!pickedPath) {
      return
    }

    setAddingFolder(true)
    try {
      const workspaceId = await createWorkspace(pickedPath)
      await focusWorkspace(workspaceId)
    } catch (error) {
      setActionError(getErrorMessage(error, "Failed to add the selected folder. Try again."))
    } finally {
      setAddingFolder(false)
    }
  }, [createWorkspace, focusWorkspace, pickFolder])

  const handleRelinkWorkspace = useCallback(async (workspaceId: string) => {
    setActionError(null)

    let pickedPath: string | null
    try {
      pickedPath = await pickFolder()
    } catch (error) {
      setActionError(
        getErrorMessage(error, "Failed to open the folder picker. Restart the desktop app and try again."),
      )
      return
    }

    if (!pickedPath) {
      return
    }

    setBusyWorkspaceId(workspaceId)
    try {
      await relinkWorkspace(workspaceId, pickedPath)
      if (effectiveSelection.workspaceId === workspaceId) {
        await navigate({
          to: effectiveSelection.threadId
            ? "/chat/$workspaceId/$threadId"
            : "/chat/$workspaceId",
          params: effectiveSelection.threadId
            ? { workspaceId, threadId: effectiveSelection.threadId }
            : { workspaceId },
        })
      }
    } catch (error) {
      setActionError(getErrorMessage(error, "Failed to relink the folder. Try again."))
    } finally {
      setBusyWorkspaceId(null)
    }
  }, [
    effectiveSelection.threadId,
    effectiveSelection.workspaceId,
    navigate,
    pickFolder,
    relinkWorkspace,
  ])

  const handleDeleteWorkspace = useCallback(async (
    workspaceId: string,
    workspaceName: string,
    threadCount: number,
  ) => {
    const chatLabel = threadCount === 1 ? "chat" : "chats"
    const confirmed = window.confirm(
      `Remove "${workspaceName}" and delete ${threadCount} ${chatLabel} from Student Claw? The real folder on disk will not be deleted.`,
    )
    if (!confirmed) {
      return
    }

    setBusyWorkspaceId(workspaceId)
    try {
      await deleteWorkspace(workspaceId)
      if (effectiveSelection.workspaceId === workspaceId) {
        await navigate({ to: "/chat" })
      }
    } finally {
      setBusyWorkspaceId(null)
    }
  }, [deleteWorkspace, effectiveSelection.workspaceId, navigate])

  const handleWorkspaceClick = useCallback(async (workspaceId: string) => {
    await focusWorkspace(workspaceId)
  }, [focusWorkspace])

  const startThreadRename = useCallback((thread: OrchestrationThread) => {
    setActionError(null)
    setEditingThreadId(thread.id)
    setEditingTitle(thread.title)
  }, [])

  const cancelThreadRename = useCallback(() => {
    setEditingThreadId(null)
    setEditingTitle("")
  }, [])

  const handleRenameThread = useCallback(async (
    threadId: string,
    workspaceId: string,
  ) => {
    const normalizedTitle = editingTitle.trim()
    if (normalizedTitle.length === 0) {
      setActionError("Thread title cannot be empty.")
      return
    }

    const existingThread = snapshot?.threads.find((thread) => thread.id === threadId)
    if (!existingThread) {
      cancelThreadRename()
      return
    }

    if (existingThread.title === normalizedTitle) {
      cancelThreadRename()
      return
    }

    setActionError(null)
    setBusyThreadId(threadId)
    try {
      await renameThread(threadId, normalizedTitle)
      if (effectiveSelection.threadId === threadId) {
        await navigate({
          to: "/chat/$workspaceId/$threadId",
          params: { workspaceId, threadId },
        })
      }
      cancelThreadRename()
    } catch (error) {
      setActionError(getErrorMessage(error, "Failed to rename the chat. Try again."))
    } finally {
      setBusyThreadId(null)
    }
  }, [
    cancelThreadRename,
    editingTitle,
    effectiveSelection.threadId,
    navigate,
    renameThread,
    snapshot?.threads,
  ])

  const handleDeleteThread = useCallback(async (
    threadId: string,
    workspaceId: string,
    title: string,
  ) => {
    const confirmed = window.confirm(
      `Delete "${title}" and remove its message history from Student Claw?`,
    )
    if (!confirmed) {
      return
    }

    setActionError(null)
    setBusyThreadId(threadId)
    try {
      await deleteThread(threadId)
      if (editingThreadId === threadId) {
        cancelThreadRename()
      }
      if (effectiveSelection.threadId === threadId) {
        await navigate({
          to: "/chat/$workspaceId",
          params: { workspaceId },
        })
      }
    } catch (error) {
      setActionError(getErrorMessage(error, "Failed to delete the chat. Try again."))
    } finally {
      setBusyThreadId(null)
    }
  }, [
    cancelThreadRename,
    deleteThread,
    editingThreadId,
    effectiveSelection.threadId,
    navigate,
  ])

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
        {actionError && (
          <p className="px-2 pb-2 text-xs text-destructive">{actionError}</p>
        )}
        {workspaces.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">No folders yet</p>
        ) : (
          <div className="space-y-2">
            {workspaces.map((workspace) => {
              const workspaceThreads = threadsByWorkspaceId.get(workspace.id) ?? []
              const isCollapsed = collapsedWorkspaceIds.has(workspace.id)
              const isWorkspaceActive =
                effectiveSelection.workspaceId === workspace.id && effectiveSelection.threadId === null
              const isWorkspaceMissing = workspace.availability === "missing"
              const isWorkspaceBusy = busyWorkspaceId === workspace.id

              return (
                <div key={workspace.id} className="rounded-md border border-transparent">
                  <div className="flex items-start gap-1 px-1 group/folder">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 px-0"
                      onClick={() => toggleWorkspaceExpanded(workspace.id)}
                      aria-label={isCollapsed ? `Expand ${workspace.name}` : `Collapse ${workspace.name}`}
                    >
                      <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        size={14}
                        strokeWidth={2}
                        className={`transition-transform duration-200 ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
                      />
                    </Button>
                    <button
                      type="button"
                      title={workspace.rootPath}
                      className={`flex min-w-0 flex-1 flex-col rounded-md px-2 py-1 text-left transition-colors ${
                        isWorkspaceActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60"
                      }`}
                      onClick={() => void handleWorkspaceClick(workspace.id)}
                    >
                      <span className="truncate text-sm font-medium">{workspace.name}</span>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 px-0 opacity-0 group-hover/folder:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => void handleDeleteWorkspace(workspace.id, workspace.name, workspaceThreads.length)}
                      disabled={isWorkspaceBusy}
                      aria-label={`Delete ${workspace.name}`}
                    >
                      <HugeiconsIcon icon={Delete01Icon} size={14} />
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
                        onClick={() => void handleDeleteWorkspace(workspace.id, workspace.name, workspaceThreads.length)}
                        disabled={isWorkspaceBusy}
                      >
                        Remove
                      </Button>
                    </div>
                  )}

                  {!isCollapsed && (
                    <div className="pl-10 pr-2 pb-1 animate-in fade-in slide-in-from-top-1 duration-150">
                      {workspaceThreads.length === 0 ? (
                        <p className="px-2 py-1 text-xs text-muted-foreground">No chats yet</p>
                      ) : (
                        <SidebarMenu>
                          {workspaceThreads.map((thread) => {
                            const isThreadSelected = effectiveSelection.threadId === thread.id
                            const indicator = getThreadIndicator(thread, isThreadSelected, seenThreadTurns)
                            const isEditingThread = editingThreadId === thread.id
                            const isThreadBusy = busyThreadId === thread.id

                            return (
                              <SidebarMenuItem key={thread.id}>
                                {isEditingThread ? (
                                  <form
                                    className="rounded-lg bg-sidebar-accent/60 p-2"
                                    onSubmit={(event) => {
                                      event.preventDefault()
                                      void handleRenameThread(thread.id, workspace.id)
                                    }}
                                  >
                                    <Input
                                      value={editingTitle}
                                      onChange={(event) => setEditingTitle(event.target.value)}
                                      autoFocus
                                      disabled={isThreadBusy}
                                      aria-label={`Rename ${thread.title}`}
                                      className="h-8 bg-background"
                                      onKeyDown={(event) => {
                                        if (event.key === "Escape") {
                                          event.preventDefault()
                                          cancelThreadRename()
                                        }
                                      }}
                                    />
                                    <div className="mt-2 flex justify-end gap-2">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7"
                                        onClick={cancelThreadRename}
                                        disabled={isThreadBusy}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        type="submit"
                                        size="sm"
                                        className="h-7"
                                        disabled={isThreadBusy}
                                      >
                                        Save
                                      </Button>
                                    </div>
                                  </form>
                                ) : (
                                  <>
                                    <SidebarMenuButton
                                      isActive={isThreadSelected}
                                      onClick={() => void focusThread(workspace.id, thread.id, thread.currentTurnId)}
                                      className="flex h-auto items-center gap-2 py-1 pr-9"
                                      disabled={isThreadBusy}
                                    >
                                      <span className="flex size-3 shrink-0 items-center justify-center">
                                        {indicator === "spinner" && <Spinner className="size-3" />}
                                        {indicator === "green-dot" && (
                                          <span className="block size-2 rounded-full bg-green-500" />
                                        )}
                                        {indicator === "gray-dot" && (
                                          <span className="block size-2 rounded-full bg-muted-foreground/40" />
                                        )}
                                      </span>
                                      <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                                    </SidebarMenuButton>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <SidebarMenuAction
                                          showOnHover
                                          aria-label={`Open actions for ${thread.title}`}
                                          disabled={isThreadBusy}
                                        >
                                          <HugeiconsIcon icon={MoreHorizontalCircle01Icon} size={14} />
                                        </SidebarMenuAction>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => startThreadRename(thread)}>
                                          Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          variant="destructive"
                                          onSelect={() => void handleDeleteThread(thread.id, workspace.id, thread.title)}
                                        >
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </>
                                )}
                              </SidebarMenuItem>
                            )
                          })}
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
