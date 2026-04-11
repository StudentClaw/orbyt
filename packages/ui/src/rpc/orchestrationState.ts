import type {
  OrchestrationDomainEvent,
  OrchestrationSnapshot,
  OrchestrationThread,
  OrchestrationTurn,
  ProviderRuntimeEvent,
} from "@student-claw/contracts"
import type { WsRpcClient } from "./wsRpcClient"
import { appAtomRegistry, createAtom, useAtomValue } from "./atomRegistry"

const orchestrationSnapshotAtom = createAtom<OrchestrationSnapshot | null>(
  "orchestration-snapshot",
  null,
)

const providerRuntimeEventsAtom = createAtom<ReadonlyArray<ProviderRuntimeEvent>>(
  "provider-runtime-events",
  [],
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
            workspaces: [event.workspace],
            threads: [],
            turns: [],
            providerStatus: "idle",
            ready: true,
            lastSequence: sequence,
          }
    case "workspace.updated":
      if (!current) {
        return {
          workspaces: [event.workspace],
          threads: [],
          turns: [],
          providerStatus: "idle",
          ready: true,
          lastSequence: sequence,
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
        return {
          workspaces: [],
          threads: [],
          turns: [],
          providerStatus: "idle",
          ready: true,
          lastSequence: sequence,
        }
      }
      return {
        ...current,
        workspaces: current.workspaces.filter((workspace) => workspace.id !== event.workspaceId),
        threads: current.threads.filter((thread) => !event.deletedThreadIds.includes(thread.id)),
        turns: current.turns.filter((turn) => !event.deletedThreadIds.includes(turn.threadId)),
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
            workspaces: [],
            threads: [event.thread],
            turns: [],
            providerStatus: "idle",
            ready: true,
            lastSequence: sequence,
          }
    case "turn.started":
    case "turn.updated":
    case "turn.completed":
    case "turn.interrupted":
      if (!current) {
        return {
          workspaces: [],
          threads: [],
          turns: [],
          providerStatus: "idle",
          ready: true,
          lastSequence: sequence,
        }
      }
      return applyTurnEvent(current, event.turn, sequence)
  }
}

export function getOrchestrationSnapshot(): OrchestrationSnapshot | null {
  return appAtomRegistry.get(orchestrationSnapshotAtom)
}

export function setOrchestrationSnapshot(snapshot: OrchestrationSnapshot): void {
  appAtomRegistry.set(orchestrationSnapshotAtom, snapshot)
  syncChatUiState(snapshot)
}

export function applyOrchestrationDomainEvent(
  event: OrchestrationDomainEvent,
  sequence: number,
): void {
  const nextSnapshot = applyDomainEvent(getOrchestrationSnapshot(), event, sequence)
  appAtomRegistry.set(orchestrationSnapshotAtom, nextSnapshot)
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

  if (event.type === "provider.turnInterrupted") {
    const nextSnapshot: OrchestrationSnapshot = {
      ...current,
      providerStatus: "interrupted",
    }
    appAtomRegistry.set(orchestrationSnapshotAtom, nextSnapshot)
    return
  }

  if (event.type === "provider.turnStarted" || event.type === "provider.token") {
    const nextSnapshot: OrchestrationSnapshot = {
      ...current,
      providerStatus: "streaming",
    }
    appAtomRegistry.set(orchestrationSnapshotAtom, nextSnapshot)
    return
  }

  if (event.type === "provider.turnCompleted") {
    const nextSnapshot: OrchestrationSnapshot = {
      ...current,
      providerStatus: "idle",
    }
    appAtomRegistry.set(orchestrationSnapshotAtom, nextSnapshot)
  }
}

export function startOrchestrationStateSync(client: WsRpcClient): () => void {
  let disposed = false

  const syncSnapshot = () => {
    void client.orchestration.getSnapshot().then((snapshot) => {
      if (!disposed) {
        setOrchestrationSnapshot(snapshot)
      }
    }).catch(() => undefined)
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
  }

  return () => {
    disposed = true
    for (const cleanup of cleanups) {
      cleanup()
    }
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

export async function sendOrchestrationTurn(
  client: WsRpcClient,
  threadId: string,
  content: string,
): Promise<string> {
  const result = await client.orchestration.sendTurn(threadId, content)
  return result.turnId
}

export async function interruptOrchestrationTurn(
  client: WsRpcClient,
  threadId: string,
): Promise<boolean> {
  const result = await client.orchestration.interruptTurn(threadId)
  return result.interrupted
}

export function useOrchestrationSnapshot(): OrchestrationSnapshot | null {
  return useAtomValue(orchestrationSnapshotAtom)
}

export function useProviderRuntimeEvents(): ReadonlyArray<ProviderRuntimeEvent> {
  return useAtomValue(providerRuntimeEventsAtom)
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
  appAtomRegistry.set(chatUiStateAtom, INITIAL_CHAT_UI_STATE)
}
