import type {
  OrchestrationDomainEvent,
  OrchestrationSnapshot,
  OrchestrationThread,
  OrchestrationTurn,
  ProviderApprovalDecision,
  ProviderRuntimeEvent,
  ProviderRuntimeState,
  ThreadAccessMode,
  TurnAttachmentInput,
} from "@student-claw/contracts"
import type { ToolCallInfo } from "@/hooks/chat-model"
import type { WsRpcClient } from "./wsRpcClient"
import { appAtomRegistry, createAtom, useAtomValue } from "./atomRegistry"

const FALLBACK_PROVIDER_RUNTIME: ProviderRuntimeState = {
  adapter: "stub",
  status: "idle",
  authState: "unknown",
  lastError: null,
  queuedTurnCount: 0,
  lastUpdatedAt: new Date().toISOString(),
}

const orchestrationSnapshotAtom = createAtom<OrchestrationSnapshot | null>(
  "orchestration-snapshot",
  null,
)

const providerRuntimeEventsAtom = createAtom<ReadonlyArray<ProviderRuntimeEvent>>(
  "provider-runtime-events",
  [],
)

type StoredToolCall = ToolCallInfo & {
  readonly itemId: string
}

const providerToolCallsAtom = createAtom<Readonly<Record<string, ReadonlyArray<StoredToolCall>>>>(
  "provider-tool-calls",
  {},
)

export interface ChatUiState {
  readonly selectedWorkspaceId: string | null
  readonly selectedThreadId: string | null
  readonly chatPanelOpen: boolean
  readonly chatPanelWidth: number
}

export const DEFAULT_CHAT_PANEL_WIDTH = 33

const INITIAL_CHAT_UI_STATE: ChatUiState = {
  selectedWorkspaceId: null,
  selectedThreadId: null,
  chatPanelOpen: false,
  chatPanelWidth: DEFAULT_CHAT_PANEL_WIDTH,
}

const chatUiStateAtom = createAtom<ChatUiState>(
  "chat-ui-state",
  INITIAL_CHAT_UI_STATE,
)

function buildEmptySnapshot(sequence = 0): OrchestrationSnapshot {
  return {
    workspaces: [],
    threads: [],
    turns: [],
    pendingApprovals: [],
    providerStatus: "idle",
    providerRuntime: FALLBACK_PROVIDER_RUNTIME,
    ready: true,
    lastSequence: sequence,
  }
}

function syncChatUiState(snapshot: OrchestrationSnapshot | null): void {
  const current = appAtomRegistry.get(chatUiStateAtom)

  if (!snapshot || snapshot.workspaces.length === 0) {
    if (current.selectedWorkspaceId === null && current.selectedThreadId === null) {
      return
    }

    appAtomRegistry.set(chatUiStateAtom, {
      ...current,
      selectedWorkspaceId: null,
      selectedThreadId: null,
    })
    return
  }

  let nextWorkspaceId = current.selectedWorkspaceId
  let nextThreadId = current.selectedThreadId

  if (nextThreadId) {
    const thread = snapshot.threads.find((entry) => entry.id === nextThreadId) ?? null
    if (!thread) {
      nextThreadId = null
    } else {
      nextWorkspaceId = thread.workspaceId
    }
  }

  if (
    nextWorkspaceId
    && !snapshot.workspaces.some((workspace) => workspace.id === nextWorkspaceId)
  ) {
    nextWorkspaceId = null
    nextThreadId = null
  }

  if (
    nextWorkspaceId === current.selectedWorkspaceId
    && nextThreadId === current.selectedThreadId
  ) {
    return
  }

  appAtomRegistry.set(chatUiStateAtom, {
    ...current,
    selectedWorkspaceId: nextWorkspaceId,
    selectedThreadId: nextThreadId,
  })
}

function pruneProviderToolCalls(snapshot: OrchestrationSnapshot | null): void {
  if (!snapshot) {
    appAtomRegistry.set(providerToolCallsAtom, {})
    return
  }

  const allowedTurnIds = new Set<string>(snapshot.turns.map((turn) => turn.id))
  const current = appAtomRegistry.get(providerToolCallsAtom)
  const next = Object.fromEntries(
    Object.entries(current).filter(([turnId]) => allowedTurnIds.has(turnId)),
  )

  appAtomRegistry.set(providerToolCallsAtom, next)
}

function applyTurnEvent(
  current: OrchestrationSnapshot,
  turn: OrchestrationTurn,
  sequence?: number,
): OrchestrationSnapshot {
  const turns = current.turns.filter((entry) => entry.id !== turn.id).concat(turn)
  const nextStatus: OrchestrationThread["status"] =
    turn.status === "completed"
      ? "completed"
      : turn.status === "interrupted"
        ? "interrupted"
        : turn.status === "queued"
          ? "queued"
          : "streaming"

  const threads = current.threads.map((thread) =>
    thread.id === turn.threadId
      ? {
          ...thread,
          status: nextStatus,
          currentTurnId:
            turn.status === "completed" || turn.status === "interrupted" ? null : turn.id,
        }
      : thread,
  )

  return {
    ...current,
    threads,
    turns,
    pendingApprovals:
      turn.status === "completed" || turn.status === "interrupted"
        ? current.pendingApprovals.filter((approval) => approval.turnId !== turn.id)
        : current.pendingApprovals,
    lastSequence: sequence ?? current.lastSequence,
  }
}

function applyDomainEvent(
  current: OrchestrationSnapshot | null,
  event: OrchestrationDomainEvent,
  sequence: number,
): OrchestrationSnapshot {
  switch (event.type) {
    case "workspace.created":
      return current
        ? {
            ...current,
            workspaces: current.workspaces
              .filter((workspace) => workspace.id !== event.workspace.id)
              .concat(event.workspace),
            lastSequence: sequence,
          }
        : {
            ...buildEmptySnapshot(sequence),
            workspaces: [event.workspace],
          }
    case "workspace.updated":
      if (!current) {
        return {
          ...buildEmptySnapshot(sequence),
          workspaces: [event.workspace],
        }
      }
      return {
        ...current,
        workspaces: current.workspaces.map((workspace) =>
          workspace.id === event.workspace.id ? event.workspace : workspace,
        ),
        lastSequence: sequence,
      }
    case "workspace.deleted":
      if (!current) {
        return buildEmptySnapshot(sequence)
      }
      return {
        ...current,
        workspaces: current.workspaces.filter((workspace) => workspace.id !== event.workspaceId),
        threads: current.threads.filter((thread) => !event.deletedThreadIds.includes(thread.id)),
        turns: current.turns.filter((turn) => !event.deletedThreadIds.includes(turn.threadId)),
        pendingApprovals: current.pendingApprovals.filter(
          (approval) => !event.deletedThreadIds.includes(approval.threadId),
        ),
        lastSequence: sequence,
      }
    case "thread.created":
      return current
        ? {
            ...current,
            threads: current.threads.filter((thread) => thread.id !== event.thread.id).concat(event.thread),
            lastSequence: sequence,
          }
        : {
            ...buildEmptySnapshot(sequence),
            threads: [event.thread],
          }
    case "thread.updated":
      if (!current) {
        return {
          ...buildEmptySnapshot(sequence),
          threads: [event.thread],
        }
      }
      return {
        ...current,
        threads: current.threads.map((thread) => thread.id === event.thread.id ? event.thread : thread),
        lastSequence: sequence,
      }
    case "thread.deleted":
      if (!current) {
        return buildEmptySnapshot(sequence)
      }
      return {
        ...current,
        threads: current.threads.filter((thread) => thread.id !== event.threadId),
        turns: current.turns.filter((turn) => turn.threadId !== event.threadId),
        pendingApprovals: current.pendingApprovals.filter(
          (approval) => approval.threadId !== event.threadId,
        ),
        lastSequence: sequence,
      }
    case "turn.queued":
    case "turn.started":
    case "turn.updated":
    case "turn.completed":
    case "turn.interrupted":
      if (!current) {
        return buildEmptySnapshot(sequence)
      }
      return applyTurnEvent(current, event.turn, sequence)
  }
}

export function getOrchestrationSnapshot(): OrchestrationSnapshot | null {
  return appAtomRegistry.get(orchestrationSnapshotAtom)
}

export function setOrchestrationSnapshot(snapshot: OrchestrationSnapshot): void {
  appAtomRegistry.set(orchestrationSnapshotAtom, snapshot)
  pruneProviderToolCalls(snapshot)
  syncChatUiState(snapshot)
}

export function applyOrchestrationDomainEvent(
  event: OrchestrationDomainEvent,
  sequence: number,
): void {
  const nextSnapshot = applyDomainEvent(getOrchestrationSnapshot(), event, sequence)
  appAtomRegistry.set(orchestrationSnapshotAtom, nextSnapshot)
  pruneProviderToolCalls(nextSnapshot)
  syncChatUiState(nextSnapshot)
}

export function applyProviderRuntimeEvent(event: ProviderRuntimeEvent): void {
  appAtomRegistry.set(
    providerRuntimeEventsAtom,
    [event, ...appAtomRegistry.get(providerRuntimeEventsAtom)].slice(0, 8),
  )

  const current = getOrchestrationSnapshot()
  if (!current) {
    return
  }

  if (event.type === "provider.mcpToolCall") {
    const currentToolCalls = appAtomRegistry.get(providerToolCallsAtom)
    const existing = currentToolCalls[event.turnId] ?? []
    const serializedArgs = (() => {
      try {
        return JSON.stringify(event.args ?? {}, null, 2)
      } catch {
        return "{}"
      }
    })()
    const nextToolCall: StoredToolCall = {
      itemId: event.itemId,
      toolName: event.toolName,
      args: serializedArgs,
      status: event.status,
      message: event.message,
      error: event.error,
    }
    const nextForTurn = existing.some((toolCall) => toolCall.itemId === event.itemId)
      ? existing.map((toolCall) => (toolCall.itemId === event.itemId ? nextToolCall : toolCall))
      : [...existing, nextToolCall]

    appAtomRegistry.set(providerToolCallsAtom, {
      ...currentToolCalls,
      [event.turnId]: nextForTurn,
    })
    return
  }

  if (event.type === "provider.stateChanged") {
    const nextSnapshot: OrchestrationSnapshot = {
      ...current,
      providerStatus: event.state.status,
      providerRuntime: event.state,
    }
    appAtomRegistry.set(orchestrationSnapshotAtom, nextSnapshot)
    return
  }

  if (event.type === "provider.turnInterrupted") {
    const nextSnapshot: OrchestrationSnapshot = {
      ...current,
      pendingApprovals: current.pendingApprovals.filter((approval) => approval.turnId !== event.turnId),
      providerStatus: "interrupted",
      providerRuntime: {
        ...current.providerRuntime,
        status: "interrupted",
      },
    }
    appAtomRegistry.set(orchestrationSnapshotAtom, nextSnapshot)
    return
  }

  if (event.type === "provider.turnStarted" || event.type === "provider.token") {
    const nextSnapshot: OrchestrationSnapshot = {
      ...current,
      providerStatus: "streaming",
      providerRuntime: {
        ...current.providerRuntime,
        status: "streaming",
      },
    }
    appAtomRegistry.set(orchestrationSnapshotAtom, nextSnapshot)
    return
  }

  if (event.type === "provider.approvalRequested") {
    const nextSnapshot: OrchestrationSnapshot = {
      ...current,
      pendingApprovals: current.pendingApprovals.some((approval) => approval.id === event.approval.id)
        ? current.pendingApprovals.map((approval) =>
            approval.id === event.approval.id ? event.approval : approval,
          )
        : [...current.pendingApprovals, event.approval],
    }
    appAtomRegistry.set(orchestrationSnapshotAtom, nextSnapshot)
    return
  }

  if (event.type === "provider.approvalResolved") {
    const nextSnapshot: OrchestrationSnapshot = {
      ...current,
      pendingApprovals: current.pendingApprovals.filter(
        (approval) => approval.id !== event.approvalRequestId,
      ),
    }
    appAtomRegistry.set(orchestrationSnapshotAtom, nextSnapshot)
    return
  }

  if (event.type === "provider.turnCompleted") {
    const nextSnapshot: OrchestrationSnapshot = {
      ...current,
      pendingApprovals: current.pendingApprovals.filter((approval) => approval.turnId !== event.turnId),
      providerStatus: "idle",
      providerRuntime: {
        ...current.providerRuntime,
        status: "idle",
      },
    }
    appAtomRegistry.set(orchestrationSnapshotAtom, nextSnapshot)
  }
}

export function startOrchestrationStateSync(client: WsRpcClient): {
  stop: () => void
  initialSnapshotReady: Promise<void>
} {
  let disposed = false
  let initialSnapshotSettled = false
  let resolveInitialSnapshot: (() => void) | null = null
  let rejectInitialSnapshot: ((error: Error) => void) | null = null

  const initialSnapshotReady = new Promise<void>((resolve, reject) => {
    resolveInitialSnapshot = resolve
    rejectInitialSnapshot = reject
  })

  const settleInitialSnapshot = (error?: Error) => {
    if (initialSnapshotSettled) {
      return
    }

    initialSnapshotSettled = true
    if (error) {
      rejectInitialSnapshot?.(error)
      return
    }

    resolveInitialSnapshot?.()
  }

  const syncSnapshot = () => {
    void client.orchestration.getSnapshot().then((snapshot) => {
      if (!disposed) {
        setOrchestrationSnapshot(snapshot)
        settleInitialSnapshot()
      }
    }).catch((error: unknown) => {
      if (disposed) {
        return
      }

      settleInitialSnapshot(
        error instanceof Error
          ? error
          : new Error("Failed to load the initial orchestration snapshot."),
      )
    })
  }

  const cleanups = [
    client.orchestration.onDomainEvent(
      (event, sequence) => {
        applyOrchestrationDomainEvent(event, sequence)
      },
      { onResubscribe: syncSnapshot },
    ),
    client.provider.onRuntimeEvent(
      (event) => {
        applyProviderRuntimeEvent(event)
      },
      { onResubscribe: syncSnapshot },
    ),
  ]

  if (getOrchestrationSnapshot() === null) {
    syncSnapshot()
  } else {
    settleInitialSnapshot()
  }

  return {
    stop: () => {
      disposed = true
      for (const cleanup of cleanups) {
        cleanup()
      }
    },
    initialSnapshotReady,
  }
}

export async function createOrchestrationWorkspace(
  client: WsRpcClient,
  rootPath: string,
): Promise<string> {
  const result = await client.orchestration.createWorkspace(rootPath)
  return result.workspaceId
}

export async function relinkOrchestrationWorkspace(
  client: WsRpcClient,
  workspaceId: string,
  rootPath: string,
): Promise<string> {
  const result = await client.orchestration.relinkWorkspace(workspaceId, rootPath)
  return result.workspaceId
}

export async function deleteOrchestrationWorkspace(
  client: WsRpcClient,
  workspaceId: string,
): Promise<boolean> {
  const result = await client.orchestration.deleteWorkspace(workspaceId)
  return result.deleted
}

export async function createOrchestrationThread(
  client: WsRpcClient,
  workspaceId: string,
  title?: string,
): Promise<string> {
  const result = await client.orchestration.createThread(workspaceId, title)
  return result.threadId
}

export async function renameOrchestrationThread(
  client: WsRpcClient,
  threadId: string,
  title: string,
): Promise<string> {
  const result = await client.orchestration.renameThread(threadId, title)
  return result.threadId
}

export async function deleteOrchestrationThread(
  client: WsRpcClient,
  threadId: string,
): Promise<boolean> {
  const result = await client.orchestration.deleteThread(threadId)
  return result.deleted
}

export async function setOrchestrationThreadAccessMode(
  client: WsRpcClient,
  threadId: string,
  accessMode: ThreadAccessMode,
): Promise<ThreadAccessMode> {
  const result = await client.orchestration.setThreadAccessMode(threadId, accessMode)
  return result.accessMode
}

export async function sendOrchestrationTurn(
  client: WsRpcClient,
  threadId: string,
  content: string,
  attachments: readonly TurnAttachmentInput[],
  model?: string | null,
  skillId?: string | null,
): Promise<string> {
  const result = await client.orchestration.sendTurn(threadId, content, attachments, model, skillId)
  return result.turnId
}

export async function interruptOrchestrationTurn(
  client: WsRpcClient,
  threadId: string,
): Promise<boolean> {
  const result = await client.orchestration.interruptTurn(threadId)
  return result.interrupted
}

export async function startOrchestrationProviderAuth(client: WsRpcClient): Promise<boolean> {
  const result = await client.provider.startAuth()
  return result.started
}

export async function retryOrchestrationProviderInitialize(client: WsRpcClient): Promise<boolean> {
  const result = await client.provider.retryInitialize()
  return result.started
}

export async function respondToProviderApproval(
  client: WsRpcClient,
  approvalRequestId: string,
  decision: ProviderApprovalDecision,
): Promise<boolean> {
  const result = await client.provider.respondToApproval(approvalRequestId, decision)
  return result.resolved
}

export function useOrchestrationSnapshot(): OrchestrationSnapshot | null {
  return useAtomValue(orchestrationSnapshotAtom)
}

export function useProviderRuntimeEvents(): ReadonlyArray<ProviderRuntimeEvent> {
  return useAtomValue(providerRuntimeEventsAtom)
}

export function useProviderToolCallsByTurnId(): Readonly<Record<string, ReadonlyArray<ToolCallInfo>>> {
  return useAtomValue(providerToolCallsAtom)
}

export function getChatUiState(): ChatUiState {
  return appAtomRegistry.get(chatUiStateAtom)
}

export function useChatUiState(): ChatUiState {
  return useAtomValue(chatUiStateAtom)
}

export function useSelectedChatWorkspaceId(): string | null {
  return useAtomValue(chatUiStateAtom, (value) => value.selectedWorkspaceId)
}

export function useSelectedChatThreadId(): string | null {
  return useAtomValue(chatUiStateAtom, (value) => value.selectedThreadId)
}

export function useChatPanelOpen(): boolean {
  return useAtomValue(chatUiStateAtom, (value) => value.chatPanelOpen)
}

export function useChatPanelWidth(): number {
  return useAtomValue(chatUiStateAtom, (value) => value.chatPanelWidth)
}

export function selectChatWorkspace(workspaceId: string | null): void {
  const current = getChatUiState()
  appAtomRegistry.set(chatUiStateAtom, {
    ...current,
    selectedWorkspaceId: workspaceId,
    selectedThreadId: null,
  })
}

export function selectChatTarget(workspaceId: string | null, threadId: string | null): void {
  const current = getChatUiState()
  appAtomRegistry.set(chatUiStateAtom, {
    ...current,
    selectedWorkspaceId: workspaceId,
    selectedThreadId: threadId,
  })
}

export function setSelectedChatThread(threadId: string | null): void {
  const current = getChatUiState()
  appAtomRegistry.set(chatUiStateAtom, {
    ...current,
    selectedThreadId: threadId,
  })
}

export function clearChatSelection(): void {
  const current = getChatUiState()
  appAtomRegistry.set(chatUiStateAtom, {
    ...current,
    selectedWorkspaceId: null,
    selectedThreadId: null,
  })
}

export function openChatPanel(): void {
  const current = getChatUiState()
  appAtomRegistry.set(chatUiStateAtom, {
    ...current,
    chatPanelOpen: true,
  })
}

export function closeChatPanel(): void {
  const current = getChatUiState()
  appAtomRegistry.set(chatUiStateAtom, {
    ...current,
    chatPanelOpen: false,
  })
}

export function setChatPanelWidth(width: number): void {
  const current = getChatUiState()
  appAtomRegistry.set(chatUiStateAtom, {
    ...current,
    chatPanelWidth: width,
  })
}

export function resetOrchestrationStateForTests(): void {
  appAtomRegistry.set(orchestrationSnapshotAtom, null)
  appAtomRegistry.set(providerRuntimeEventsAtom, [])
  appAtomRegistry.set(providerToolCallsAtom, {})
  appAtomRegistry.set(chatUiStateAtom, INITIAL_CHAT_UI_STATE)
}
