import { useCallback, useEffect, useMemo, useState } from "react"
import { getPrimaryWsRpcClient, waitForPrimaryWsRpcClient } from "@/rpc/appRuntime"
import {
  clearChatSelection,
  closeChatPanel,
  createOrchestrationWorkspace,
  createOrchestrationThread,
  deleteOrchestrationThread,
  deleteOrchestrationWorkspace,
  interruptOrchestrationTurn,
  openChatPanel,
  respondToProviderApproval,
  renameOrchestrationThread,
  relinkOrchestrationWorkspace,
  selectChatTarget,
  selectChatWorkspace,
  setOrchestrationThreadAccessMode,
  setChatPanelWidth,
  useChatPanelOpen,
  useChatPanelWidth,
  sendOrchestrationTurn,
  useChatUiState,
  useOrchestrationSnapshot,
  useSelectedChatThreadId,
  useSelectedChatWorkspaceId,
  useProviderRuntimeEvents,
  useProviderToolCallsByTurnId,
} from "@/rpc/orchestrationState"
import {
  useCanvasCourseGrades,
  useCanvasCourses,
  useCanvasPeerReviewTodo,
  useCanvasSyncProgress,
  useCanvasLastSync,
  useCanvasSubmissionStatus,
  useCanvasTodoItems,
  useCanvasUpcomingAssignments,
} from "@/rpc/canvasState"
import { useDashboardSections } from "@/rpc/dashboardState"
import {
  usePlannedSessions,
  usePendingCheckIns,
} from "@/rpc/plannerState"
import { useActivityEntries, useActivityUnreadCount, useActivityFilter } from "@/rpc/activityState"
import {
  useIsOnboardingComplete as useOnboardingComplete,
  useIsHydrationComplete,
} from "@/rpc/onboardingState"
import { useRuntimeStartupState as useStartupState } from "@/rpc/runtimeStartupState"
import { useServerConfig, useServerWelcome } from "@/rpc/serverState"
import { useDesktopBootstrap, useWsConnectionStatus } from "@/rpc/wsConnectionState"
import type { TurnAttachmentInput, TurnReferenceInput } from "@orbyt/contracts"

export function useRuntimeConnectionStatus() {
  return useWsConnectionStatus()
}

export function useRuntimeBootstrap() {
  return useDesktopBootstrap()
}

export function useRuntimeStartupState() {
  return useStartupState()
}

export function useRuntimeServerConfig() {
  return useServerConfig()
}

export function useRuntimeWelcome() {
  return useServerWelcome()
}

export function useRuntimeOrchestrationSnapshot() {
  return useOrchestrationSnapshot()
}

export function useRuntimeProviderEvents() {
  return useProviderRuntimeEvents()
}

export function useRuntimeProviderToolCallsByTurnId() {
  return useProviderToolCallsByTurnId()
}

export function useRuntimeCourses() {
  return useCanvasCourses()
}

export function useRuntimeUpcomingAssignments() {
  return useCanvasUpcomingAssignments()
}

export function useRuntimeSubmissionStatus() {
  return useCanvasSubmissionStatus()
}

export function useRuntimeCourseGrades() {
  return useCanvasCourseGrades()
}

export function useRuntimeTodoItems() {
  return useCanvasTodoItems()
}

export function useRuntimePeerReviewTodo() {
  return useCanvasPeerReviewTodo()
}

export function useRuntimeCanvasSyncProgress() {
  return useCanvasSyncProgress()
}

export function useRuntimeCanvasLastSync() {
  return useCanvasLastSync()
}

export function useRuntimeDashboardSections() {
  return useDashboardSections()
}

export function useRuntimePlannedSessions() {
  return usePlannedSessions()
}

export function useRuntimePendingCheckIns() {
  return usePendingCheckIns()
}

export function useRuntimeActivityEntries() {
  return useActivityEntries()
}

export function useRuntimeActivityUnreadCount() {
  return useActivityUnreadCount()
}

export function useRuntimeActivityFilter() {
  return useActivityFilter()
}

export function useIsOnboardingComplete() {
  return useOnboardingComplete()
}

export function useIsServerHydrationComplete() {
  return useIsHydrationComplete()
}

export function useRuntimeChatUiState() {
  return useChatUiState()
}

export function useRuntimeSelectedThreadId() {
  return useSelectedChatThreadId()
}

export function useRuntimeSelectedWorkspaceId() {
  return useSelectedChatWorkspaceId()
}

export function useRuntimeChatPanelOpen() {
  return useChatPanelOpen()
}

export function useRuntimeChatPanelWidth() {
  return useChatPanelWidth()
}

export function useOrchestrationActions() {
  return useMemo(() => {
    return {
      createWorkspace: (rootPath: string) =>
        createOrchestrationWorkspace(getPrimaryWsRpcClient(), rootPath),
      relinkWorkspace: (workspaceId: string, rootPath: string) =>
        relinkOrchestrationWorkspace(getPrimaryWsRpcClient(), workspaceId, rootPath),
      deleteWorkspace: (workspaceId: string) =>
        deleteOrchestrationWorkspace(getPrimaryWsRpcClient(), workspaceId),
      createThread: (workspaceId: string, title?: string) =>
        createOrchestrationThread(getPrimaryWsRpcClient(), workspaceId, title),
      renameThread: (threadId: string, title: string) =>
        renameOrchestrationThread(getPrimaryWsRpcClient(), threadId, title),
      deleteThread: (threadId: string) =>
        deleteOrchestrationThread(getPrimaryWsRpcClient(), threadId),
      setThreadAccessMode: (threadId: string, accessMode: "default" | "full") =>
        setOrchestrationThreadAccessMode(getPrimaryWsRpcClient(), threadId, accessMode),
      sendTurn: (
        threadId: string,
        content: string,
        attachments: readonly TurnAttachmentInput[],
        model?: string | null,
        skillId?: string | null,
        references?: readonly TurnReferenceInput[],
      ) =>
        sendOrchestrationTurn(
          getPrimaryWsRpcClient(),
          threadId,
          content,
          attachments,
          model,
          skillId,
          references,
        ),
      interruptTurn: (threadId: string) => interruptOrchestrationTurn(getPrimaryWsRpcClient(), threadId),
      startProviderAuth: () =>
        getPrimaryWsRpcClient().provider.startAuth(),
      retryProviderInitialize: () =>
        getPrimaryWsRpcClient().provider.retryInitialize(),
      respondToApproval: (approvalRequestId: string, decision: "approve" | "deny") =>
        respondToProviderApproval(getPrimaryWsRpcClient(), approvalRequestId, decision),
    }
  }, [])
}

export function useChatUiActions() {
  return useMemo(() => {
    return {
      selectWorkspace: (workspaceId: string | null) => selectChatWorkspace(workspaceId),
      selectChatTarget: (workspaceId: string | null, threadId: string | null) =>
        selectChatTarget(workspaceId, threadId),
      clearSelection: () => clearChatSelection(),
      openPanel: () => openChatPanel(),
      closePanel: () => closeChatPanel(),
      setPanelWidth: (width: number) => setChatPanelWidth(width),
    }
  }, [])
}

export type SkillEntry = {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly tier?: "curated" | "custom"
  readonly version?: string
  readonly requestedCapabilities?: readonly string[]
  readonly grantedCapabilities?: readonly string[]
  readonly missingCapabilities?: readonly string[]
  readonly forkedFrom?: string | null
  readonly editable?: boolean
}

export function useSkills(): readonly SkillEntry[] {
  const { skills } = useSkillsState()
  return skills
}

export type SkillsState = {
  readonly skills: readonly SkillEntry[]
  readonly refresh: () => Promise<void>
}

export function useSkillsState(): SkillsState {
  const [skills, setSkills] = useState<readonly SkillEntry[]>([])

  const refresh = useCallback(async () => {
    try {
      const client = await waitForPrimaryWsRpcClient()
      const result = await client.skills.list()
      setSkills(result.skills as readonly SkillEntry[])
    } catch {
      setSkills([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const client = await waitForPrimaryWsRpcClient()
        const result = await client.skills.list()
        if (!cancelled) setSkills(result.skills as readonly SkillEntry[])
      } catch {
        if (!cancelled) setSkills([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { skills, refresh }
}
