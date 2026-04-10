import { useMemo } from "react"
import { useRouterState } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Message01Icon,
} from "@hugeicons/core-free-icons"
import {
  useChatUiActions,
  useOrchestrationActions,
  useRuntimeConnectionStatus,
  useRuntimeOrchestrationSnapshot,
  useRuntimeSelectedThreadId,
} from "@/hooks/useAppRuntime"
import { sortThreadsByRecency } from "@/hooks/chat-model"
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

function ThreadItem({
  active,
  onSelect,
  status,
  title,
}: {
  readonly active: boolean
  readonly onSelect: () => void
  readonly status: string
  readonly title: string
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        onClick={onSelect}
        className="flex h-auto items-start gap-2 py-2"
      >
        <HugeiconsIcon icon={Message01Icon} size={14} className="mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{title}</span>
          <span className="block text-xs text-muted-foreground">{status}</span>
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function ChatHistory() {
  const routerState = useRouterState()
  const snapshot = useRuntimeOrchestrationSnapshot()
  const selectedThreadId = useRuntimeSelectedThreadId()
  const connectionStatus = useRuntimeConnectionStatus()
  const { createThread } = useOrchestrationActions()
  const { openPanel, selectThread } = useChatUiActions()

  const threads = useMemo(() => {
    return sortThreadsByRecency(snapshot?.threads ?? [])
  }, [snapshot?.threads])

  const handleSelectThread = (threadId: string) => {
    selectThread(threadId)
    if (routerState.location.pathname !== "/chat") {
      openPanel()
    }
  }

  const handleCreateThread = async () => {
    if (connectionStatus.phase !== "connected") {
      return
    }

    const threadId = await createThread("New chat")
    selectThread(threadId)
    if (routerState.location.pathname !== "/chat") {
      openPanel()
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Chats</SidebarGroupLabel>
      <SidebarGroupAction
        title="New chat"
        onClick={() => void handleCreateThread()}
        disabled={connectionStatus.phase !== "connected"}
      >
        <HugeiconsIcon icon={Add01Icon} size={16} />
        <span className="sr-only">New chat</span>
      </SidebarGroupAction>
      <SidebarGroupContent>
        {threads.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">No chats yet</p>
        ) : (
          <SidebarMenu>
            {threads.map((thread) => (
              <ThreadItem
                key={thread.id}
                active={thread.id === selectedThreadId}
                onSelect={() => handleSelectThread(thread.id)}
                status={thread.status}
                title={thread.title}
              />
            ))}
          </SidebarMenu>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
