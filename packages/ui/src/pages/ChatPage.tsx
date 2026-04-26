import { useCallback, useEffect, useState } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { ChatContainer } from "@/components/chat/ChatContainer"
import { isChatPath, resolveChatRouteSelection } from "@/lib/chatRoutes"
import { useRuntimeOrchestrationSnapshot } from "@/hooks/useAppRuntime"
import { ArtifactProvider } from "@/context/ArtifactContext"
import { ArtifactDrawer } from "@/components/artifacts/ArtifactDrawer"

export function ChatPage() {
  const navigate = useNavigate()
  const snapshot = useRuntimeOrchestrationSnapshot()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const selection = resolveChatRouteSelection(pathname)
  const [pendingCreatedThread, setPendingCreatedThread] = useState<{
    workspaceId: string
    threadId: string
  } | null>(null)

  useEffect(() => {
    if (!snapshot || !isChatPath(pathname) || selection.workspaceId) {
      return
    }

    const workspace = snapshot.workspaces[0]
    if (workspace) {
      void navigate({
        to: "/chat/$workspaceId",
        params: { workspaceId: workspace.id },
        replace: true,
      })
    }
  }, [navigate, pathname, selection.workspaceId, snapshot])

  useEffect(() => {
    if (!pendingCreatedThread) {
      return
    }

    if (selection.threadId !== pendingCreatedThread.threadId) {
      setPendingCreatedThread(null)
      return
    }

    const threadExists = snapshot?.threads.some((thread) => thread.id === pendingCreatedThread.threadId) ?? false
    if (threadExists) {
      setPendingCreatedThread(null)
    }
  }, [pendingCreatedThread, selection.threadId, snapshot])

  useEffect(() => {
    if (!snapshot || !selection.workspaceId) {
      return
    }

    const workspaceExists = snapshot.workspaces.some((workspace) => workspace.id === selection.workspaceId)
    if (!workspaceExists) {
      void navigate({ to: "/chat" })
      return
    }

    if (!selection.threadId) {
      return
    }

    const thread = snapshot.threads.find((entry) => entry.id === selection.threadId) ?? null
    if (!thread) {
      if (
        pendingCreatedThread
        && pendingCreatedThread.threadId === selection.threadId
        && pendingCreatedThread.workspaceId === selection.workspaceId
      ) {
        return
      }

      void navigate({
        to: "/chat/$workspaceId",
        params: { workspaceId: selection.workspaceId },
      })
      return
    }

    if (thread.workspaceId !== selection.workspaceId) {
      void navigate({
        to: "/chat/$workspaceId/$threadId",
        params: {
          workspaceId: thread.workspaceId,
          threadId: thread.id,
        },
      })
    }
  }, [navigate, pendingCreatedThread, selection.threadId, selection.workspaceId, snapshot])

  const handleThreadCreated = useCallback(async (workspaceId: string, threadId: string) => {
    setPendingCreatedThread({ workspaceId, threadId })
    await navigate({
      to: "/chat/$workspaceId/$threadId",
      params: {
        workspaceId,
        threadId,
      },
    })
  }, [navigate])

  return (
    <ArtifactProvider>
      <div className="h-full">
        <ChatContainer
          variant="page"
          selection={{
            workspaceId: selection.workspaceId,
            threadId: selection.threadId,
            onThreadCreated: handleThreadCreated,
          }}
        />
        <ArtifactDrawer />
      </div>
    </ArtifactProvider>
  )
}
