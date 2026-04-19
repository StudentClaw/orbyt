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
  readonly activeRuntimeCount: number
  readonly warmRuntimeCount: number
  readonly maxRuntimeCount: number
  readonly bootstrapReady: boolean
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
  readonly turnInactivityTimeoutMs?: number
  readonly turnWatchdogTickMs?: number
  readonly interruptEscalationMs?: number
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
  readonly warmBootstrap: () => Promise<void>
  readonly shutdown: () => Promise<void>
}

export class ThreadRuntimeManager extends Context.Tag("ThreadRuntimeManager")<
  ThreadRuntimeManager,
  ThreadRuntimeManagerService
>() {}

const DEFAULT_INACTIVITY_TIMEOUT_MS = 90_000
const DEFAULT_WATCHDOG_TICK_MS = 5_000
const DEFAULT_INTERRUPT_ESCALATION_MS = 5_000

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

type TurnWatchdog = {
  readonly touch: () => void
  readonly stop: () => void
}

export function createThreadRuntimeManager(
  options: ThreadRuntimeManagerOptions,
): ThreadRuntimeManagerService {
  const maxActiveRuntimes = options.maxActiveRuntimes ?? 4
  const now = options.now ?? (() => Date.now())
  const turnInactivityTimeoutMs =
    options.turnInactivityTimeoutMs ?? DEFAULT_INACTIVITY_TIMEOUT_MS
  const turnWatchdogTickMs = options.turnWatchdogTickMs ?? DEFAULT_WATCHDOG_TICK_MS
  const interruptEscalationMs =
    options.interruptEscalationMs ?? DEFAULT_INTERRUPT_ESCALATION_MS
  const slots = new Map<string, ThreadRuntimeSlot>()
  const queuedTurns: ManagedTurnInput[] = []
  const inFlightTurnTasks = new Set<Promise<void>>()
  const activeWatchdogs = new Set<TurnWatchdog>()
  let bootstrapRuntime: CodexCliService | null = null
  let bootstrapWarmPromise: Promise<void> | null = null
  let admissionChain: Promise<unknown> = Promise.resolve()
  let shuttingDown = false

  // Single admission mutex: every state transition that reads/writes slot capacity
  // or the queued-turns list serializes through this chain. This is the only
  // concurrency primitive — there is no secondary `admitting` flag, because a flag
  // would let callers that arrive while admission is mid-flight return prematurely
  // without observing the final state.
  const runExclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const previous = admissionChain
    const run = (async () => {
      try {
        await previous
      } catch {
        // Previous task errors are its caller's responsibility; do not block the chain.
      }
      return fn()
    })()
    admissionChain = run.catch(() => undefined)
    return run
  }

  const trackInFlightTurn = (task: Promise<void>): void => {
    inFlightTurnTasks.add(task)
    void task.finally(() => {
      inFlightTurnTasks.delete(task)
    })
  }

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

  const claimNewRuntime = (): CodexCliService => {
    if (bootstrapRuntime) {
      const runtime = bootstrapRuntime
      bootstrapRuntime = null
      return runtime
    }
    return options.runtimeFactory()
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

  const createWatchdog = (
    slot: ThreadRuntimeSlot,
    input: ManagedTurnInput,
    onStall: (failure: ProviderRuntimeFailure) => void,
  ): TurnWatchdog => {
    let lastActivityAt = now()
    let stopped = false
    let fired = false

    const tick = (): void => {
      if (stopped || fired) return
      if (now() - lastActivityAt <= turnInactivityTimeoutMs) return

      fired = true
      clearInterval(interval)

      void (async () => {
        const failure = new ProviderRuntimeFailure(
          "codex_turn_stalled",
          `Turn ${input.turnId} on thread ${input.threadId} produced no activity for ${turnInactivityTimeoutMs}ms.`,
          false,
        )

        let interruptAcknowledged = false
        try {
          const interruptPromise = slot.runtime.interruptTurn(
            input.threadId,
            input.turnId,
          )
          const timeoutPromise = new Promise<"escalate">((resolve) => {
            setTimeout(() => resolve("escalate"), interruptEscalationMs)
          })
          const result = await Promise.race([interruptPromise, timeoutPromise])
          interruptAcknowledged = result !== "escalate"
        } catch {
          interruptAcknowledged = false
        }

        if (!interruptAcknowledged) {
          try {
            await slot.runtime.shutdown()
          } catch {
            // best-effort shutdown
          }
        }

        onStall(failure)
      })()
    }

    const interval = setInterval(tick, turnWatchdogTickMs)
    if (typeof (interval as { unref?: () => void }).unref === "function") {
      (interval as { unref?: () => void }).unref?.()
    }

    const watchdog: TurnWatchdog = {
      touch: () => {
        lastActivityAt = now()
      },
      stop: () => {
        stopped = true
        clearInterval(interval)
        activeWatchdogs.delete(watchdog)
      },
    }

    activeWatchdogs.add(watchdog)
    return watchdog
  }

  const startTurnOnSlot = async (
    slot: ThreadRuntimeSlot,
    input: ManagedTurnInput,
  ): Promise<void> => {
    slot.currentTurnId = input.turnId
    slot.state = "active"

    let settled = false
    let watchdog: TurnWatchdog | null = null

    const settle = async (
      outcome: "completed" | "interrupted" | "retry" | "failed",
    ): Promise<void> => {
      if (settled) {
        return
      }
      settled = true
      if (watchdog) {
        watchdog.stop()
        watchdog = null
      }
      await releaseSlot(slot, outcome)
      void admitQueuedTurns()
    }

    const handleStall = (failure: ProviderRuntimeFailure): void => {
      void (async () => {
        if (settled) return
        try {
          await input.onError(failure)
        } catch {
          // swallow — we are already in a failure path
        }
        // Stalls are non-retryable: destroy the slot so the next turn gets a fresh runtime.
        await settle("failed")
      })()
    }

    watchdog = createWatchdog(slot, input, handleStall)

    const touchOnActivity = watchdog

    const wrappedOnToken: ManagedTurnInput["onToken"] = async (token, index) => {
      touchOnActivity.touch()
      await input.onToken(token, index)
    }
    const wrappedOnReasoning: ManagedTurnInput["onReasoning"] = async (token, index) => {
      touchOnActivity.touch()
      await input.onReasoning(token, index)
    }
    const wrappedOnMcpToolCall: ManagedTurnInput["onMcpToolCall"] = async (event) => {
      touchOnActivity.touch()
      await input.onMcpToolCall(event)
    }
    const wrappedOnApprovalRequest: ManagedTurnInput["onApprovalRequest"] = async (
      approval,
    ) => {
      touchOnActivity.touch()
      await input.onApprovalRequest(approval)
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
        onToken: wrappedOnToken,
        onReasoning: wrappedOnReasoning,
        onCompleted: async () => {
          if (settled) return
          await input.onCompleted()
          await settle("completed")
        },
        onInterrupted: async () => {
          if (settled) return
          await input.onInterrupted()
          await settle("interrupted")
        },
        onError: async (error) => {
          if (settled) return
          const disposition = await input.onError(error)
          await settle(disposition === "retry" ? "retry" : "failed")
          if (disposition === "retry" && !shuttingDown) {
            queuedTurns.push(input)
            // Await the re-admission so callers that are themselves awaiting this
            // onError callback see the new runtime in place before they observe state.
            await admitQueuedTurns()
          }
        },
        onMcpToolCall: wrappedOnMcpToolCall,
        onApprovalRequest: wrappedOnApprovalRequest,
      })
    } catch (error) {
      if (settled) return
      const disposition = await input.onError(normalizeFailure(error))
      await settle(disposition === "retry" ? "retry" : "failed")
      if (disposition === "retry" && !shuttingDown) {
        queuedTurns.push(input)
        await admitQueuedTurns()
      }
    }
  }

  const tryAdmitTurnUnlocked = async (input: ManagedTurnInput): Promise<boolean> => {
    const warmSlot = getWarmestReusableSlot(input.threadId)
    if (warmSlot) {
      trackInFlightTurn(startTurnOnSlot(warmSlot, input))
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
      runtime: claimNewRuntime(),
      currentTurnId: null,
      state: "active",
      lastUsedAt: now(),
    }
    slots.set(input.threadId, slot)
    trackInFlightTurn(startTurnOnSlot(slot, input))
    return true
  }

  const admitQueuedTurns = (): Promise<void> =>
    runExclusive(async () => {
      if (shuttingDown) return
      while (queuedTurns.length > 0) {
        const next = queuedTurns[0]
        if (!next) break
        const admitted = await tryAdmitTurnUnlocked(next)
        if (!admitted) break
        queuedTurns.shift()
      }
    })

  return {
    submitTurn: async (input) =>
      runExclusive(async () => {
        if (shuttingDown) {
          throw new Error("Thread runtime manager is shutting down.")
        }

        if (hasQueuedOrActiveTurn(input.threadId)) {
          throw new ThreadRuntimeBusyError(input.threadId)
        }

        // Preserve FIFO: if anything is already queued, don't jump the line unless we can reuse
        // this thread's own warm slot. No need to fire admitQueuedTurns here — there is no
        // new capacity to admit against; the next slot release will drive admission.
        if (!getWarmestReusableSlot(input.threadId) && queuedTurns.length > 0) {
          queuedTurns.push(input)
          return { admission: "queued" }
        }

        const admitted = await tryAdmitTurnUnlocked(input)
        if (admitted) {
          return { admission: "started" }
        }

        queuedTurns.push(input)
        return { admission: "queued" }
      }),
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
      // Mutate state inside the admission mutex so any in-flight admission observes the
      // consistent post-dispose view, then immediately drain the queue with the freed slot.
      await runExclusive(async () => {
        for (let index = queuedTurns.length - 1; index >= 0; index -= 1) {
          if (queuedTurns[index]?.threadId === threadId) {
            queuedTurns.splice(index, 1)
          }
        }

        const slot = slots.get(threadId)
        if (slot) {
          slots.delete(threadId)
          await slot.runtime.shutdown()
        }

        while (queuedTurns.length > 0) {
          const next = queuedTurns[0]
          if (!next) break
          const admitted = await tryAdmitTurnUnlocked(next)
          if (!admitted) break
          queuedTurns.shift()
        }
      })
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
    getSnapshot: () => {
      const activeTurns: ManagedTurnRef[] = []
      const warmThreads: { threadId: string; lastUsedAt: number }[] = []
      let activeCount = 0
      let warmCount = 0

      for (const slot of slots.values()) {
        if (slot.currentTurnId !== null) {
          activeTurns.push({
            threadId: slot.threadId,
            turnId: slot.currentTurnId,
          })
        }
        if (slot.state === "active") {
          activeCount += 1
        } else {
          warmCount += 1
          warmThreads.push({
            threadId: slot.threadId,
            lastUsedAt: slot.lastUsedAt,
          })
        }
      }

      return {
        activeTurns,
        queuedTurns: queuedTurns.map((queued) => ({
          threadId: queued.threadId,
          turnId: queued.turnId,
        })),
        warmThreads,
        activeRuntimeCount: activeCount,
        warmRuntimeCount: warmCount,
        maxRuntimeCount: maxActiveRuntimes,
        bootstrapReady: bootstrapRuntime !== null,
      }
    },
    warmBootstrap: async () => {
      if (shuttingDown || bootstrapRuntime || bootstrapWarmPromise) {
        await bootstrapWarmPromise
        return
      }
      const runtime = options.runtimeFactory()
      bootstrapRuntime = runtime
      bootstrapWarmPromise = (async () => {
        try {
          await runtime.initialize()
        } catch (error) {
          // If pre-warming fails, clear the bootstrap reference so the next submission
          // creates a fresh runtime on demand rather than reusing a broken process.
          if (bootstrapRuntime === runtime) {
            bootstrapRuntime = null
          }
          try {
            await runtime.shutdown()
          } catch {
            // best-effort
          }
          throw error
        } finally {
          bootstrapWarmPromise = null
        }
      })()
      await bootstrapWarmPromise
    },
    shutdown: async () => {
      shuttingDown = true
      queuedTurns.splice(0, queuedTurns.length)
      for (const watchdog of Array.from(activeWatchdogs)) {
        watchdog.stop()
      }
      const runtimes = Array.from(slots.values()).map((slot) => slot.runtime)
      slots.clear()
      const pendingBootstrap = bootstrapRuntime
      bootstrapRuntime = null
      const toShutdown: Promise<void>[] = runtimes.map((runtime) => runtime.shutdown())
      if (pendingBootstrap) {
        toShutdown.push(pendingBootstrap.shutdown())
      }
      await Promise.allSettled(toShutdown)
      await Promise.allSettled(Array.from(inFlightTurnTasks))
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
