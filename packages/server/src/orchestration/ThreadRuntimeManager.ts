import { Context, Effect, Layer } from "effect"
import {
  type ProviderApprovalDecision,
  type ProviderPendingApproval,
  type ThreadAccessMode,
} from "@student-claw/contracts"
import {
  createCodexRuntimeInstance,
  type CodexCliService,
  ProviderRuntimeFailure,
} from "../ai/CodexCli.js"
import { ProviderRuntimeStore } from "../ai/ProviderRuntimeStore.js"
import { ConfigService } from "../config/ConfigService.js"
import { PluginGateway } from "../mcp/PluginGateway.js"

type StreamTurnCallbacks = Parameters<CodexCliService["streamTurn"]>[0]

export type ThreadRuntimeErrorDisposition = "interrupt" | "retry"

export type ManagedTurnInput = {
  readonly threadId: string
  readonly turnId: string
  readonly content: string
  readonly cwd?: string | null
  readonly accessMode?: ThreadAccessMode
  readonly model?: string | null
  readonly onStart: () => Promise<void>
  readonly onToken: StreamTurnCallbacks["onToken"]
  readonly onReasoning: StreamTurnCallbacks["onReasoning"]
  readonly onCompleted: () => Promise<void>
  readonly onInterrupted: () => Promise<void>
  readonly onError: (error: ProviderRuntimeFailure) => Promise<ThreadRuntimeErrorDisposition>
  readonly onMcpToolCall: StreamTurnCallbacks["onMcpToolCall"]
  readonly onApprovalRequest: StreamTurnCallbacks["onApprovalRequest"]
}

export type ManagedTurnRef = {
  readonly threadId: string
  readonly turnId: string
}

export type ThreadRuntimeSnapshot = {
  readonly activeTurns: ReadonlyArray<ManagedTurnRef>
  readonly queuedTurns: ReadonlyArray<ManagedTurnRef>
  readonly warmThreads: ReadonlyArray<{
    readonly threadId: string
    readonly lastUsedAt: number
  }>
}

export type SubmitTurnResult = {
  readonly admission: "started" | "queued"
}

export type InterruptManagedTurnResult = {
  readonly interrupted: boolean
  readonly disposition: "active" | "queued" | "missing"
}

export class ThreadRuntimeBusyError extends Error {
  constructor(threadId: string) {
    super(`Thread ${threadId} already has a queued or active turn.`)
    this.name = "ThreadRuntimeBusyError"
  }
}

type ThreadRuntimeSlot = {
  readonly threadId: string
  readonly runtime: CodexCliService
  currentTurnId: string | null
  state: "active" | "warm-idle"
  lastUsedAt: number
}

type ThreadRuntimeManagerOptions = {
  readonly runtimeFactory: () => CodexCliService
  readonly maxActiveRuntimes?: number
  readonly now?: () => number
}

export interface ThreadRuntimeManagerService {
  readonly submitTurn: (input: ManagedTurnInput) => Promise<SubmitTurnResult>
  readonly interruptTurn: (
    threadId: string,
    turnId: string,
  ) => Promise<InterruptManagedTurnResult>
  readonly disposeThread: (threadId: string) => Promise<void>
  readonly listPendingApprovals: () => ReadonlyArray<ProviderPendingApproval>
  readonly respondToApproval: (
    approvalRequestId: string,
    decision: ProviderApprovalDecision,
  ) => Promise<{
    approvalRequestId: string
    threadId: string
    turnId: string
    decision: ProviderApprovalDecision
    resolved: boolean
  }>
  readonly getSnapshot: () => ThreadRuntimeSnapshot
  readonly shutdown: () => Promise<void>
}

export class ThreadRuntimeManager extends Context.Tag("ThreadRuntimeManager")<
  ThreadRuntimeManager,
  ThreadRuntimeManagerService
>() {}

function normalizeFailure(error: unknown): ProviderRuntimeFailure {
  if (error instanceof ProviderRuntimeFailure) {
    return error
  }

  return new ProviderRuntimeFailure(
    "codex_turn_failed",
    error instanceof Error ? error.message : "Unknown orchestration runtime error",
    true,
  )
}

export function createThreadRuntimeManager(
  options: ThreadRuntimeManagerOptions,
): ThreadRuntimeManagerService {
  const maxActiveRuntimes = options.maxActiveRuntimes ?? 4
  const now = options.now ?? (() => Date.now())
  const slots = new Map<string, ThreadRuntimeSlot>()
  const queuedTurns: ManagedTurnInput[] = []
  let admitting = false
  let shuttingDown = false

  const getWarmestReusableSlot = (threadId: string): ThreadRuntimeSlot | null => {
    const slot = slots.get(threadId)
    if (!slot || slot.state !== "warm-idle") {
      return null
    }
    return slot
  }

  const findLeastRecentlyUsedWarmSlot = (): ThreadRuntimeSlot | null => {
    let candidate: ThreadRuntimeSlot | null = null
    for (const slot of slots.values()) {
      if (slot.state !== "warm-idle") {
        continue
      }
      if (!candidate || slot.lastUsedAt < candidate.lastUsedAt) {
        candidate = slot
      }
    }
    return candidate
  }

  const hasQueuedOrActiveTurn = (threadId: string): boolean =>
    queuedTurns.some((queued) => queued.threadId === threadId)
    || (slots.get(threadId)?.currentTurnId ?? null) !== null

  const evictWarmSlotIfNeeded = async (): Promise<boolean> => {
    if (slots.size < maxActiveRuntimes) {
      return true
    }

    const warmSlot = findLeastRecentlyUsedWarmSlot()
    if (!warmSlot) {
      return false
    }

    slots.delete(warmSlot.threadId)
    await warmSlot.runtime.shutdown()
    return true
  }

  const releaseSlot = async (
    slot: ThreadRuntimeSlot,
    outcome: "completed" | "interrupted" | "retry" | "failed",
  ): Promise<void> => {
    slot.currentTurnId = null
    slot.lastUsedAt = now()

    if (shuttingDown || outcome === "retry" || outcome === "failed") {
      slots.delete(slot.threadId)
      await slot.runtime.shutdown()
      return
    }

    slot.state = "warm-idle"
  }

  const startTurnOnSlot = async (
    slot: ThreadRuntimeSlot,
    input: ManagedTurnInput,
  ): Promise<void> => {
    slot.currentTurnId = input.turnId
    slot.state = "active"

    let settled = false
    const settle = async (
      outcome: "completed" | "interrupted" | "retry" | "failed",
    ): Promise<void> => {
      if (settled) {
        return
      }
      settled = true
      await releaseSlot(slot, outcome)
      void admitQueuedTurns()
    }

    try {
      await input.onStart()
      await slot.runtime.streamTurn({
        localThreadId: input.threadId,
        localTurnId: input.turnId,
        content: input.content,
        cwd: input.cwd,
        accessMode: input.accessMode,
        model: input.model,
        onToken: input.onToken,
        onReasoning: input.onReasoning,
        onCompleted: async () => {
          await input.onCompleted()
          await settle("completed")
        },
        onInterrupted: async () => {
          await input.onInterrupted()
          await settle("interrupted")
        },
        onError: async (error) => {
          const disposition = await input.onError(error)
          await settle(disposition === "retry" ? "retry" : "failed")
          if (disposition === "retry" && !shuttingDown) {
            queuedTurns.push(input)
            void admitQueuedTurns()
          }
        },
        onMcpToolCall: input.onMcpToolCall,
        onApprovalRequest: input.onApprovalRequest,
      })
    } catch (error) {
      const disposition = await input.onError(normalizeFailure(error))
      await settle(disposition === "retry" ? "retry" : "failed")
      if (disposition === "retry" && !shuttingDown) {
        queuedTurns.push(input)
        void admitQueuedTurns()
      }
    }
  }

  const tryAdmitTurn = async (input: ManagedTurnInput): Promise<boolean> => {
    const warmSlot = getWarmestReusableSlot(input.threadId)
    if (warmSlot) {
      void startTurnOnSlot(warmSlot, input)
      return true
    }

    if (!(await evictWarmSlotIfNeeded())) {
      return false
    }

    if (slots.size >= maxActiveRuntimes) {
      return false
    }

    const slot: ThreadRuntimeSlot = {
      threadId: input.threadId,
      runtime: options.runtimeFactory(),
      currentTurnId: null,
      state: "active",
      lastUsedAt: now(),
    }
    slots.set(input.threadId, slot)
    void startTurnOnSlot(slot, input)
    return true
  }

  const admitQueuedTurns = async (): Promise<void> => {
    if (admitting || shuttingDown) {
      return
    }

    admitting = true
    try {
      while (queuedTurns.length > 0) {
        const next = queuedTurns[0]
        if (!next) {
          break
        }
        const admitted = await tryAdmitTurn(next)
        if (!admitted) {
          break
        }
        queuedTurns.shift()
      }
    } finally {
      admitting = false
      if (!shuttingDown && queuedTurns.length > 0) {
        const next = queuedTurns[0]
        if (
          next
          && (
            getWarmestReusableSlot(next.threadId)
            || slots.size < maxActiveRuntimes
            || findLeastRecentlyUsedWarmSlot()
          )
        ) {
          void admitQueuedTurns()
        }
      }
    }
  }

  return {
    submitTurn: async (input) => {
      if (shuttingDown) {
        throw new Error("Thread runtime manager is shutting down.")
      }

      if (hasQueuedOrActiveTurn(input.threadId)) {
        throw new ThreadRuntimeBusyError(input.threadId)
      }

      if (!getWarmestReusableSlot(input.threadId) && queuedTurns.length > 0) {
        queuedTurns.push(input)
        void admitQueuedTurns()
        return { admission: "queued" }
      }

      const admitted = await tryAdmitTurn(input)
      if (admitted) {
        return { admission: "started" }
      }

      queuedTurns.push(input)
      void admitQueuedTurns()
      return { admission: "queued" }
    },
    interruptTurn: async (threadId, turnId) => {
      const queuedIndex = queuedTurns.findIndex(
        (entry) => entry.threadId === threadId && entry.turnId === turnId,
      )
      if (queuedIndex >= 0) {
        queuedTurns.splice(queuedIndex, 1)
        return { interrupted: true, disposition: "queued" }
      }

      const slot = slots.get(threadId)
      if (!slot || slot.currentTurnId !== turnId) {
        return { interrupted: false, disposition: "missing" }
      }

      const interrupted = await slot.runtime.interruptTurn(threadId, turnId)
      return {
        interrupted,
        disposition: "active",
      }
    },
    disposeThread: async (threadId) => {
      for (let index = queuedTurns.length - 1; index >= 0; index -= 1) {
        if (queuedTurns[index]?.threadId === threadId) {
          queuedTurns.splice(index, 1)
        }
      }

      const slot = slots.get(threadId)
      if (!slot) {
        void admitQueuedTurns()
        return
      }

      slots.delete(threadId)
      await slot.runtime.shutdown()
      await admitQueuedTurns()
    },
    listPendingApprovals: () =>
      Array.from(slots.values()).flatMap((slot) => slot.runtime.listPendingApprovals()),
    respondToApproval: async (approvalRequestId, decision) => {
      for (const slot of slots.values()) {
        const approvals = slot.runtime.listPendingApprovals()
        if (!approvals.some((approval) => approval.id === approvalRequestId)) {
          continue
        }
        return slot.runtime.respondToApproval(approvalRequestId, decision)
      }

      return {
        approvalRequestId,
        threadId: "",
        turnId: "",
        decision,
        resolved: false,
      }
    },
    getSnapshot: () => ({
      activeTurns: Array.from(slots.values())
        .filter((slot) => slot.currentTurnId !== null)
        .map((slot) => ({
          threadId: slot.threadId,
          turnId: slot.currentTurnId ?? "",
        })),
      queuedTurns: queuedTurns.map((queued) => ({
        threadId: queued.threadId,
        turnId: queued.turnId,
      })),
      warmThreads: Array.from(slots.values())
        .filter((slot) => slot.state === "warm-idle")
        .map((slot) => ({
          threadId: slot.threadId,
          lastUsedAt: slot.lastUsedAt,
        })),
    }),
    shutdown: async () => {
      shuttingDown = true
      queuedTurns.splice(0, queuedTurns.length)
      const runtimes = Array.from(slots.values())
      slots.clear()
      await Promise.allSettled(runtimes.map((slot) => slot.runtime.shutdown()))
    },
  }
}

export const ThreadRuntimeManagerLive = Layer.effect(
  ThreadRuntimeManager,
  Effect.gen(function* () {
    const config = yield* ConfigService
    const pluginGateway = yield* PluginGateway
    const runtimeStore = yield* ProviderRuntimeStore

    return createThreadRuntimeManager({
      runtimeFactory: () =>
        createCodexRuntimeInstance({
          config,
          pluginGateway,
          runtimeStore,
        }),
    })
  }),
)
