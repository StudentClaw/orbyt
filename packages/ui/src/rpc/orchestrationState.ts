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
  readonly selectedThreadId: string | null
  readonly chatPanelOpen: boolean
  readonly chatPanelWidth: number
}

export const DEFAULT_CHAT_PANEL_WIDTH = 33

const INITIAL_CHAT_UI_STATE: ChatUiState = {
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

  if (!snapshot || snapshot.threads.length === 0) {
    if (current.selectedThreadId === null) {
      return
    }
    appAtomRegistry.set(chatUiStateAtom, {
      ...current,
      selectedThreadId: null,
    })
    return
  }

  if (current.selectedThreadId && snapshot.threads.some((entry) => entry.id === current.selectedThreadId)) {
    return
  }

  appAtomRegistry.set(chatUiStateAtom, {
    ...current,
    selectedThreadId: snapshot.threads.at(-1)?.id ?? null,
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
          currentTurnId: turn.status === "completed" || turn.status === "interrupted" ? null : turn.id,
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
  const current = getOrchestrationSnapshot()

  if (event.type === "thread.created") {
    const nextSnapshot: OrchestrationSnapshot = current
      ? {
          ...current,
          threads: [...current.threads, event.thread],
          lastSequence: sequence,
        }
      : {
          threads: [event.thread],
          turns: [],
          providerStatus: "idle",
          providerRuntime: {
            adapter: "codex",
            status: "idle",
            authState: "unknown",
            lastError: null,
            queuedTurnCount: 0,
            lastUpdatedAt: new Date(0).toISOString(),
          },
          ready: true,
          lastSequence: sequence,
        }
    appAtomRegistry.set(orchestrationSnapshotAtom, nextSnapshot)
    syncChatUiState(nextSnapshot)
    return
  }

  if (!current) {
    return
  }

  appAtomRegistry.set(
    orchestrationSnapshotAtom,
    applyTurnEvent(current, event.turn, sequence),
  )
  syncChatUiState(appAtomRegistry.get(orchestrationSnapshotAtom))
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

  if (event.type === "provider.turnCompleted") {
    const nextSnapshot: OrchestrationSnapshot = {
      ...current,
      providerStatus: "idle",
      providerRuntime: {
        ...current.providerRuntime,
        status: "idle",
      },
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

export async function createOrchestrationThread(
  client: WsRpcClient,
  title?: string,
): Promise<string> {
  const result = await client.orchestration.createThread(title)
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

export function useSelectedChatThreadId(): string | null {
  return useAtomValue(chatUiStateAtom, (value) => value.selectedThreadId)
}

export function useChatPanelOpen(): boolean {
  return useAtomValue(chatUiStateAtom, (value) => value.chatPanelOpen)
}

export function useChatPanelWidth(): number {
  return useAtomValue(chatUiStateAtom, (value) => value.chatPanelWidth)
}

export function setSelectedChatThread(threadId: string | null): void {
  const current = getChatUiState()
  appAtomRegistry.set(chatUiStateAtom, {
    ...current,
    selectedThreadId: threadId,
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
