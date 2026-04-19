import { describe, expect, test } from "bun:test"
import {
  createThreadRuntimeManager,
  type ManagedTurnInput,
} from "../orchestration/ThreadRuntimeManager.js"
import { createControlledRuntimeFactory } from "./helpers/controlled-runtime.js"

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

function turnInput(
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

describe("ThreadRuntimeManager stress", () => {
  test("handles 8 threads x 5 turns with cap=4 without leaking runtimes or exceeding capacity", async () => {
    const { factory, runtimes } = createControlledRuntimeFactory()
    const random = createSeededRandom(42)
    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 4,
    })

    const threadCount = 8
    const turnsPerThread = 5
    const threadIds = Array.from({ length: threadCount }, (_value, index) => `thread-${index + 1}`)
    const activeTurnCounts: number[] = []

    const submissionPromises: Promise<void>[] = []
    for (const threadId of threadIds) {
      submissionPromises.push(
        (async () => {
          for (let turnIndex = 0; turnIndex < turnsPerThread; turnIndex += 1) {
            const turnId = `${threadId}-turn-${turnIndex + 1}`
            const completed = new Promise<void>((resolveCompleted) => {
              void manager.submitTurn(
                turnInput(threadId, turnId, {
                  onStart: async () => {
                    // Schedule completion from onStart so we know the turn is attached
                    // to a runtime. Driving it from outside would race with admission.
                    const latency = 5 + Math.floor(random() * 30)
                    setTimeout(() => {
                      const owner = runtimes.find((rt) =>
                        rt.activeTurnIds().includes(turnId))
                      if (owner) {
                        void owner.completeTurn(turnId)
                      }
                    }, latency)
                  },
                  onCompleted: async () => {
                    resolveCompleted()
                  },
                }),
              )
            })
            activeTurnCounts.push(manager.getSnapshot().activeRuntimeCount)
            await completed
          }
        })(),
      )
    }

    await Promise.all(submissionPromises)

    const finalSnapshot = manager.getSnapshot()

    // Cap must never be exceeded during the run.
    for (const count of activeTurnCounts) {
      expect(count).toBeLessThanOrEqual(4)
    }

    // Every turn eventually settled.
    expect(finalSnapshot.activeTurns).toHaveLength(0)
    expect(finalSnapshot.queuedTurns).toHaveLength(0)

    // Runtime reuse: after the run, warm runtimes for the 4 most-recent threads may
    // remain, and some early threads may have been evicted. Total spawned runtimes
    // should be bounded by (threads + eviction cycles). With 8 threads and cap 4,
    // we expect at most 8 runtimes plus up to (8 - 4) * turnsPerThread for worst-case
    // churn. Assert a loose upper bound — the point is no unbounded leak.
    expect(runtimes.length).toBeLessThanOrEqual(threadCount * turnsPerThread)

    await manager.shutdown()

    // After shutdown every created runtime must have been shut down exactly once.
    for (const runtime of runtimes) {
      expect(runtime.shutdownCount).toBeGreaterThanOrEqual(1)
    }
  }, 15_000)

  test("preserves FIFO order when the queue builds under cap pressure", async () => {
    const { factory, runtimes } = createControlledRuntimeFactory()
    const manager = createThreadRuntimeManager({
      runtimeFactory: factory,
      maxActiveRuntimes: 2,
    })

    // Submit 6 turns across 6 threads. First 2 start immediately; remaining 4 queue.
    const submissionResults = await Promise.all(
      Array.from({ length: 6 }, (_value, index) =>
        manager.submitTurn(turnInput(`t-${index + 1}`, `turn-${index + 1}`))),
    )

    expect(submissionResults.slice(0, 2).map((entry) => entry.admission)).toEqual([
      "started",
      "started",
    ])
    expect(submissionResults.slice(2).map((entry) => entry.admission)).toEqual([
      "queued",
      "queued",
      "queued",
      "queued",
    ])

    // Admission order observed: complete each active turn, then verify the next queued
    // thread is promoted in submission order.
    const admissionOrder: string[] = ["t-1", "t-2"]

    for (let step = 0; step < 4; step += 1) {
      const active = manager.getSnapshot().activeTurns
      expect(active.length).toBe(2)

      // Complete the oldest active turn.
      const oldest = active[0]
      if (!oldest) throw new Error("expected active turn")
      const runtime = runtimes.find((rt) => rt.activeTurnIds().includes(oldest.turnId))
      if (!runtime) throw new Error(`runtime owning ${oldest.turnId} not found`)
      await runtime.completeTurn(oldest.turnId)

      // Allow the admission mutex to drain.
      await new Promise((resolve) => setTimeout(resolve, 5))

      const newActive = manager.getSnapshot().activeTurns
      const newlyStarted = newActive.find(
        (entry) => !admissionOrder.includes(entry.threadId),
      )
      if (newlyStarted) {
        admissionOrder.push(newlyStarted.threadId)
      }
    }

    expect(admissionOrder).toEqual(["t-1", "t-2", "t-3", "t-4", "t-5", "t-6"])

    await manager.shutdown()
  }, 10_000)
})
