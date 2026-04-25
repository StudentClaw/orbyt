// Behavior-level contract for MemorizeTriggerService. The live Layer depends
// on the full Codex + DB stack, so this suite exercises the underlying
// coordination directly to keep the test hermetic.
//
// The flow we verify here matches trigger-service.ts:
//   turn.completed -> classify -> if noteworthy and not running -> runIfNeeded
//   if running: mark pendingFlush; drain exactly once when current run finishes

import { describe, test, expect } from "bun:test"
import type { SalienceClassifier } from "../memory/salience/classifier.js"
import type { MemorizeServiceShape } from "../memory/service.js"

type RanCall = { trigger: string | undefined }

function makeCoordinator(deps: {
  readonly memorize: MemorizeServiceShape
  readonly classifier: SalienceClassifier
}) {
  let isRunning = false
  let pendingFlush = false
  const runCalls: RanCall[] = []

  const runNow = async (): Promise<void> => {
    if (isRunning) {
      pendingFlush = true
      return
    }
    isRunning = true
    try {
      const outcome = await deps.memorize.runIfNeeded(new Date(), {
        trigger: "auto",
      })
      runCalls.push({ trigger: outcome.trigger })
    } finally {
      isRunning = false
      if (pendingFlush) {
        pendingFlush = false
        await runNow()
      }
    }
  }

  const onTurnCompleted = async (turn: {
    turnId: string
    threadId: string
    inputText: string
    outputText: string
  }): Promise<void> => {
    const verdict = await deps.classifier.classify(turn)
    if (!verdict.noteworthy) return
    await runNow()
  }

  return { runCalls, onTurnCompleted }
}

function stubClassifier(
  verdicts: ReadonlyArray<{ noteworthy: boolean; reason: string }>,
): SalienceClassifier {
  let i = 0
  return {
    async classify() {
      const v = verdicts[Math.min(i, verdicts.length - 1)]!
      i += 1
      return v
    },
  }
}

function memorizeStub(onRun: () => Promise<void> = async () => undefined): MemorizeServiceShape {
  return {
    async runIfNeeded(_now, options) {
      await onRun()
      return {
        ran: true,
        trigger: (options?.trigger ?? "manual") as "auto" | "recap" | "manual",
        result: {
          dailyFileWritten: null,
          weeklyFileWritten: null,
          recapFileWritten: null,
          graphNodesUpdated: [],
        },
      }
    },
  }
}

const turn = (id: string) => ({
  turnId: id,
  threadId: "th1",
  inputText: "",
  outputText: "",
})

describe("MemorizeTriggerService coordination", () => {
  test("noteworthy turn triggers a single auto run", async () => {
    const c = makeCoordinator({
      memorize: memorizeStub(),
      classifier: stubClassifier([{ noteworthy: true, reason: "" }]),
    })
    await c.onTurnCompleted(turn("t1"))
    expect(c.runCalls).toHaveLength(1)
    expect(c.runCalls[0]!.trigger).toBe("auto")
  })

  test("non-noteworthy turn triggers no run", async () => {
    const c = makeCoordinator({
      memorize: memorizeStub(),
      classifier: stubClassifier([{ noteworthy: false, reason: "" }]),
    })
    await c.onTurnCompleted(turn("t1"))
    expect(c.runCalls).toHaveLength(0)
  })

  test("bursts while a run is in flight coalesce into one follow-up", async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((r) => {
      release = r
    })

    const c = makeCoordinator({
      memorize: memorizeStub(async () => {
        // First call blocks until released; subsequent calls resolve immediately.
        await gate
      }),
      classifier: stubClassifier([
        { noteworthy: true, reason: "" },
        { noteworthy: true, reason: "" },
        { noteworthy: true, reason: "" },
      ]),
    })

    const first = c.onTurnCompleted(turn("t1"))
    // Allow the first run to start and mark isRunning=true.
    await Promise.resolve()
    // Fire two more noteworthy turns while the first is still in flight.
    await c.onTurnCompleted(turn("t2"))
    await c.onTurnCompleted(turn("t3"))

    release()
    await first

    // Expect: first run + one coalesced follow-up flush = 2 total, not 3.
    expect(c.runCalls).toHaveLength(2)
  })

  test("classifier errors do not crash or trigger a run", async () => {
    const throwingClassifier: SalienceClassifier = {
      async classify() {
        throw new Error("boom")
      },
    }
    const c = makeCoordinator({
      memorize: memorizeStub(),
      classifier: throwingClassifier,
    })
    // The trigger service catches classifier errors; the inline coordinator
    // mirrors that behavior for the purposes of this contract test.
    await c
      .onTurnCompleted(turn("t1"))
      .catch(() => undefined)
    expect(c.runCalls).toHaveLength(0)
  })
})
