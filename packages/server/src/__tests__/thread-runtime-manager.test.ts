import { describe, expect, test } from "bun:test"
import type {
  ProviderApprovalDecision,
  ProviderPendingApproval,
} from "@student-claw/contracts"
import {
  createThreadRuntimeManager,
  type ManagedTurnInput,
} from "../orchestration/ThreadRuntimeManager.js"
import {
  type CodexCliService,
  ProviderRuntimeFailure,
} from "../ai/CodexCli.js"

type ControlledRuntime = CodexCliService & {
  readonly id: string
  readonly streamCalls: Array<{ threadId: string; turnId: string; content: string }>
  readonly interruptedTurns: string[]
  shutdownCount: number
  completeTurn: (turnId: string) => Promise<void>
  interruptTurnCallback: (turnId: string) => Promise<void>
  failTurn: (turnId: string, error: ProviderRuntimeFailure) => Promise<void>
  emitApproval: (turnId: string, approvalId: string) => Promise<void>
}

function createControlledRuntimeFactory() {
  const runtimes: ControlledRuntime[] = []

  const factory = (): ControlledRuntime => {
    const pendingApprovals = new Map<string, ProviderPendingApproval>()
    const activeTurns = new Map<string, Parameters<CodexCliService["streamTurn"]>[0]>()
    const runtime: ControlledRuntime = {
      id: `runtime-${runtimes.length + 1}`,
      streamCalls: [],
      interruptedTurns: [],
      shutdownCount: 0,
      initialize: async () => undefined,
      retryInitialize: async () => true,
      startAuth: async () => true,
      reloadGatewayTools: async () => true,
      streamTurn: async (input) => {
        runtime.streamCalls.push({
          threadId: input.localThreadId,
          turnId: input.localTurnId,
          content: input.content,
        })
        activeTurns.set(input.localTurnId, input)
      },
      listPendingApprovals: () => Array.from(pendingApprovals.values()),
      respondToApproval: async (approvalRequestId, decision) => {
        const approval = pendingApprovals.get(approvalRequestId)
        if (!approval) {
          return {
            approvalRequestId,
            threadId: "",
            turnId: "",
            decision,
            resolved: false,
          }
        }
        pendingApprovals.delete(approvalRequestId)
        return {
          approvalRequestId,
          threadId: String(approval.threadId),
          turnId: String(approval.turnId),
          decision,
          resolved: true,
        }
      },
      interruptTurn: async (_threadId, turnId) => {
        runtime.interruptedTurns.push(turnId)
        return activeTurns.has(turnId)
      },
      shutdown: async () => {
        runtime.shutdownCount += 1
        activeTurns.clear()
        pendingApprovals.clear()
      },
      completeTurn: async (turnId) => {
        const input = activeTurns.get(turnId)
        if (!input) return
        activeTurns.delete(turnId)
        await input.onCompleted()
      },
      interruptTurnCallback: async (turnId) => {
        const input = activeTurns.get(turnId)
        if (!input) return
        activeTurns.delete(turnId)
        await input.onInterrupted()
      },
      failTurn: async (turnId, error) => {
        const input = activeTurns.get(turnId)
        if (!input) return
        activeTurns.delete(turnId)
        await input.onError(error)
      },
      emitApproval: async (turnId, approvalId) => {
        const input = activeTurns.get(turnId)
        if (!input) return
        const approval: ProviderPendingApproval = {
          id: approvalId as ProviderPendingApproval["id"],
          threadId: input.localThreadId as ProviderPendingApproval["threadId"],
          turnId: input.localTurnId as ProviderPendingApproval["turnId"],
          kind: "command",
          itemId: `item-${approvalId}`,
          approvalId,
          reason: null,
          command: "echo test",
          cwd: "/repo",
          availableDecisions: ["approve", "deny"],
        }
        pendingApprovals.set(approvalId, approval)
        await input.onApprovalRequest(approval)
      },
    }
    runtimes.push(runtime)
    return runtime
  }

  return { factory, runtimes }
}

function createTurnInput(
  threadId: string,
  turnId: string,
  overrides: Partial<ManagedTurnInput> = {},
): ManagedTurnInput {
  return {
    threadId,
    turnId,
    content: `prompt-${turnId}`,
    onStart: async () => undefined,
    onToken: async () => undefined,
    onReasoning: async () => undefined,
    onCompleted: async () => undefined,
    onInterrupted: async () => undefined,
    onError: async () => "interrupt",
    onMcpToolCall: async () => undefined,
    onApprovalRequest: async () => undefined,
    ...overrides,
  }
}

describe("ThreadRuntimeManager", () => {
  test("aggregates approvals from isolated runtime slots and resolves only the owner", async () => {
    const { factory, runtimes } = createControlledRuntimeFactory()
    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 2,
    })

    await manager.submitTurn(createTurnInput("thread-a", "turn-a"))
    await manager.submitTurn(createTurnInput("thread-b", "turn-b"))
    await runtimes[0]?.emitApproval("turn-a", "approval-a")
    await runtimes[1]?.emitApproval("turn-b", "approval-b")

    expect(manager.listPendingApprovals().map((approval) => approval.id)).toEqual([
      "approval-a",
      "approval-b",
    ])

    const resolved = await manager.respondToApproval(
      "approval-b",
      "approve" satisfies ProviderApprovalDecision,
    )

    expect(resolved).toEqual({
      approvalRequestId: "approval-b",
      threadId: "thread-b",
      turnId: "turn-b",
      decision: "approve",
      resolved: true,
    })
    expect(manager.listPendingApprovals().map((approval) => approval.id)).toEqual([
      "approval-a",
    ])
  })

  test("admits four threads and queues the fifth", async () => {
    const { factory } = createControlledRuntimeFactory()
    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 4,
    })

    const admissions = await Promise.all([
      manager.submitTurn(createTurnInput("thread-1", "turn-1")),
      manager.submitTurn(createTurnInput("thread-2", "turn-2")),
      manager.submitTurn(createTurnInput("thread-3", "turn-3")),
      manager.submitTurn(createTurnInput("thread-4", "turn-4")),
      manager.submitTurn(createTurnInput("thread-5", "turn-5")),
    ])

    expect(admissions.map((entry) => entry.admission)).toEqual([
      "started",
      "started",
      "started",
      "started",
      "queued",
    ])
    expect(manager.getSnapshot().activeTurns.map((entry) => entry.threadId)).toEqual([
      "thread-1",
      "thread-2",
      "thread-3",
      "thread-4",
    ])
    expect(manager.getSnapshot().queuedTurns).toEqual([
      { threadId: "thread-5", turnId: "turn-5" },
    ])
  })

  test("removes a queued turn before runtime start when interrupted", async () => {
    const { factory } = createControlledRuntimeFactory()
    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 1,
    })

    await manager.submitTurn(createTurnInput("thread-1", "turn-1"))
    await manager.submitTurn(createTurnInput("thread-2", "turn-2"))

    const result = await manager.interruptTurn("thread-2", "turn-2")

    expect(result).toEqual({ interrupted: true, disposition: "queued" })
    expect(manager.getSnapshot().queuedTurns).toHaveLength(0)
  })

  test("reuses a warm runtime for later turns in the same thread", async () => {
    const { factory, runtimes } = createControlledRuntimeFactory()
    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 2,
      now: (() => {
        let tick = 0
        return () => ++tick
      })(),
    })

    await manager.submitTurn(createTurnInput("thread-1", "turn-1"))
    await runtimes[0]?.completeTurn("turn-1")
    await manager.submitTurn(createTurnInput("thread-1", "turn-2"))

    expect(runtimes).toHaveLength(1)
    expect(runtimes[0]?.streamCalls.map((call) => call.turnId)).toEqual([
      "turn-1",
      "turn-2",
    ])
  })

  test("evicts the least recently used warm runtime under pressure", async () => {
    const { factory, runtimes } = createControlledRuntimeFactory()
    let tick = 0
    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 2,
      now: () => ++tick,
    })

    await manager.submitTurn(createTurnInput("thread-1", "turn-1"))
    await manager.submitTurn(createTurnInput("thread-2", "turn-2"))
    await runtimes[0]?.completeTurn("turn-1")
    await runtimes[1]?.completeTurn("turn-2")

    await manager.submitTurn(createTurnInput("thread-3", "turn-3"))

    expect(runtimes[0]?.shutdownCount).toBe(1)
    expect(runtimes[1]?.shutdownCount).toBe(0)
    expect(runtimes).toHaveLength(3)
    const evictSnapshot = manager.getSnapshot()
    expect(evictSnapshot.activeTurns).toEqual([
      { threadId: "thread-3", turnId: "turn-3" },
    ])
    expect(evictSnapshot.warmThreads.map((warm) => warm.threadId)).toEqual([
      "thread-2",
    ])
    expect(typeof evictSnapshot.warmThreads[0]?.lastUsedAt).toBe("number")
  })

  test("never evicts an active runtime while a warm slot exists", async () => {
    const { factory, runtimes } = createControlledRuntimeFactory()
    let tick = 0
    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 2,
      now: () => ++tick,
    })

    await manager.submitTurn(createTurnInput("thread-1", "turn-1"))
    await manager.submitTurn(createTurnInput("thread-2", "turn-2"))
    await runtimes[1]?.completeTurn("turn-2")

    await manager.submitTurn(createTurnInput("thread-3", "turn-3"))

    expect(runtimes[0]?.shutdownCount).toBe(0)
    expect(runtimes[1]?.shutdownCount).toBe(1)
    expect(manager.getSnapshot().activeTurns).toEqual([
      { threadId: "thread-1", turnId: "turn-1" },
      { threadId: "thread-3", turnId: "turn-3" },
    ])
  })

  test("retries a turn after a retryable runtime failure", async () => {
    const { factory, runtimes } = createControlledRuntimeFactory()
    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 1,
    })

    await manager.submitTurn(
      createTurnInput("thread-1", "turn-1", {
        onError: async () => "retry",
      }),
    )
    await runtimes[0]?.failTurn(
      "turn-1",
      new ProviderRuntimeFailure("codex_turn_failed", "retry me", true),
    )

    expect(runtimes).toHaveLength(2)
    expect(manager.getSnapshot().activeTurns).toEqual([
      { threadId: "thread-1", turnId: "turn-1" },
    ])
  })

  test("shutdown clears queued turns and destroys active and warm runtimes", async () => {
    const { factory, runtimes } = createControlledRuntimeFactory()
    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 2,
    })

    await manager.submitTurn(createTurnInput("thread-1", "turn-1"))
    await manager.submitTurn(createTurnInput("thread-2", "turn-2"))
    await runtimes[1]?.completeTurn("turn-2")
    await manager.submitTurn(createTurnInput("thread-3", "turn-3"))

    await manager.shutdown()

    const snapshot = manager.getSnapshot()
    expect(snapshot.activeTurns).toEqual([])
    expect(snapshot.queuedTurns).toEqual([])
    expect(snapshot.warmThreads).toEqual([])
    expect(snapshot.activeRuntimeCount).toBe(0)
    expect(snapshot.warmRuntimeCount).toBe(0)
    expect(runtimes.map((runtime) => runtime.shutdownCount)).toEqual([1, 1, 1])
  })

  test("getSnapshot exposes runtime counts and max cap", async () => {
    const { factory, runtimes } = createControlledRuntimeFactory()
    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 4,
    })

    await manager.submitTurn(createTurnInput("thread-1", "turn-1"))
    await manager.submitTurn(createTurnInput("thread-2", "turn-2"))
    await runtimes[0]?.completeTurn("turn-1")

    const snapshot = manager.getSnapshot()
    expect(snapshot.maxRuntimeCount).toBe(4)
    expect(snapshot.activeRuntimeCount).toBe(1)
    expect(snapshot.warmRuntimeCount).toBe(1)
    expect(snapshot.queuedTurns).toHaveLength(0)
  })

  test("serializes concurrent submissions so the cap is never exceeded", async () => {
    const { factory, runtimes } = createControlledRuntimeFactory()
    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 4,
    })

    // Fire 8 concurrent submissions from distinct threads. With a proper admission
    // mutex, exactly 4 must become "started" and 4 must become "queued".
    const results = await Promise.all(
      Array.from({ length: 8 }, (_value, index) =>
        manager.submitTurn(createTurnInput(`thread-${index + 1}`, `turn-${index + 1}`))),
    )

    const started = results.filter((entry) => entry.admission === "started").length
    const queued = results.filter((entry) => entry.admission === "queued").length
    expect(started).toBe(4)
    expect(queued).toBe(4)
    expect(runtimes.length).toBe(4)
    expect(manager.getSnapshot().activeRuntimeCount).toBe(4)
  })

  test("warmBootstrap pre-warms a runtime that is claimed by the first submission", async () => {
    const { factory, runtimes } = createControlledRuntimeFactory()
    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 2,
    })

    await manager.warmBootstrap()

    expect(runtimes).toHaveLength(1)
    expect(manager.getSnapshot().bootstrapReady).toBe(true)

    await manager.submitTurn(createTurnInput("thread-1", "turn-1"))

    expect(runtimes).toHaveLength(1)
    expect(manager.getSnapshot().bootstrapReady).toBe(false)
    expect(runtimes[0]?.streamCalls.map((call) => call.turnId)).toEqual(["turn-1"])

    // A second submission from a different thread requires a fresh runtime because
    // the bootstrap has already been claimed.
    await manager.submitTurn(createTurnInput("thread-2", "turn-2"))
    expect(runtimes).toHaveLength(2)
  })

  test("inactivity watchdog fails a stalled turn and recycles its slot", async () => {
    const { factory, runtimes } = createControlledRuntimeFactory()
    let currentTime = 1_000
    let stalledFailure: ProviderRuntimeFailure | null = null

    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 2,
      now: () => currentTime,
      turnInactivityTimeoutMs: 100,
      turnWatchdogTickMs: 10,
      interruptEscalationMs: 20,
    })

    await manager.submitTurn(
      createTurnInput("thread-1", "turn-1", {
        onError: async (failure) => {
          stalledFailure = failure
          return "interrupt"
        },
      }),
    )

    expect(runtimes[0]?.streamCalls).toHaveLength(1)

    // Simulate time passing without any onToken callback firing. The watchdog should
    // notice the inactivity, interrupt the runtime, and settle the turn as failed.
    currentTime += 500
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(stalledFailure).not.toBeNull()
    if (!stalledFailure) {
      throw new Error("Expected stalledFailure to be set by the watchdog")
    }
    const failure = stalledFailure as ProviderRuntimeFailure
    expect(failure.code).toBe("codex_turn_stalled")
    // Slot should be destroyed, not kept warm, so the runtime was shut down.
    expect(runtimes[0]?.shutdownCount).toBeGreaterThanOrEqual(1)
    expect(manager.getSnapshot().activeRuntimeCount).toBe(0)
  })

  test("watchdog resets on token activity and does not fire during healthy streaming", async () => {
    const { factory, runtimes } = createControlledRuntimeFactory()
    let currentTime = 1_000
    let stalledFailure: ProviderRuntimeFailure | null = null

    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 1,
      now: () => currentTime,
      turnInactivityTimeoutMs: 100,
      turnWatchdogTickMs: 10,
      interruptEscalationMs: 20,
    })

    await manager.submitTurn(
      createTurnInput("thread-1", "turn-1", {
        onError: async (failure) => {
          stalledFailure = failure
          return "interrupt"
        },
      }),
    )

    const runtime = runtimes[0]
    if (!runtime) throw new Error("runtime missing")

    // Simulate three bursts of activity well within the timeout window.
    const streamInput = runtime.streamCalls[0]
    expect(streamInput).toBeDefined()

    // Access the currently active turn via the runtime's internal hook.
    // We touch activity through the wrapped onToken callback by calling the runtime's
    // record of input directly. The controlled runtime stored the input in activeTurns.
    for (let index = 0; index < 3; index += 1) {
      currentTime += 50 // below the 100ms timeout
      await new Promise((resolve) => setTimeout(resolve, 15))
      // Trigger a token via the runtime (the manager's wrapper will touch the watchdog).
      // We reach into the controlled runtime: it stored the managed wrapped callbacks.
      // Use emitApproval as a cheap proxy — it also touches the watchdog through wrappedOnApprovalRequest.
      await runtime.emitApproval("turn-1", `approval-${index}`)
    }

    await runtime.completeTurn("turn-1")
    expect(stalledFailure).toBeNull()
  })

  test("disposeThread shuts down the owned runtime and admits the next queued thread", async () => {
    const { factory, runtimes } = createControlledRuntimeFactory()
    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 1,
    })

    await manager.submitTurn(createTurnInput("thread-1", "turn-1"))
    await manager.submitTurn(createTurnInput("thread-2", "turn-2"))

    await manager.disposeThread("thread-1")

    expect(runtimes[0]?.shutdownCount).toBe(1)
    const disposeSnapshot = manager.getSnapshot()
    expect(disposeSnapshot.activeTurns).toEqual([
      { threadId: "thread-2", turnId: "turn-2" },
    ])
    expect(disposeSnapshot.queuedTurns).toEqual([])
    expect(disposeSnapshot.warmThreads).toEqual([])
  })
})
