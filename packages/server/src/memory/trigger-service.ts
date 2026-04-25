import { Context, Effect, Layer } from "effect"
import type { MemorizeRunResult } from "@orbyt/contracts"
import { MemorizeService } from "./service.js"
import { LlmSalienceClassifier } from "./salience/index.js"
import type {
  SalienceClassifier,
  SalienceTurn,
} from "./salience/classifier.js"
import { CodexMemorizeDistiller } from "./distiller.js"
import { CodexCli } from "../ai/CodexCli.js"
import { TurnEventBus } from "../orchestration/TurnEventBus.js"
import {
  MEMORIZE_THREAD_ID,
} from "./distiller.js"

export interface MemorizeTriggerHookOptions {
  readonly onRan?: (result: MemorizeRunResult) => void | Promise<void>
}

export interface MemorizeTriggerServiceShape {
  readonly start: (options?: MemorizeTriggerHookOptions) => () => void
}

export class MemorizeTriggerService extends Context.Tag(
  "MemorizeTriggerService",
)<MemorizeTriggerService, MemorizeTriggerServiceShape>() {}

/**
 * Bridges completed chat turns into event-driven memorization.
 *
 * Flow: turn completes -> classifier decides if noteworthy -> if yes and no
 * other run in flight, trigger a MemorizeService run tagged trigger="auto".
 * If a run is already in flight, mark a pending flush so the buffer drains
 * exactly once on completion (coalescing rapid bursts).
 */
export const MemorizeTriggerServiceLive = Layer.effect(
  MemorizeTriggerService,
  Effect.gen(function* () {
    const memorize = yield* MemorizeService
    const eventBus = yield* TurnEventBus
    const codex = yield* CodexCli

    const classifier: SalienceClassifier = new LlmSalienceClassifier(
      new CodexMemorizeDistiller(codex),
    )

    let isRunning = false
    let pendingFlush = false

    return {
      start: (options?: MemorizeTriggerHookOptions) => {
        const runNow = async (): Promise<void> => {
          if (isRunning) {
            pendingFlush = true
            return
          }
          isRunning = true
          try {
            const outcome = await memorize.runIfNeeded(new Date(), {
              trigger: "auto",
            })
            if (outcome.ran && outcome.result && options?.onRan) {
              try {
                await options.onRan(outcome.result)
              } catch (err) {
                process.stderr.write(
                  `MemorizeTriggerService onRan error: ${String(err)}\n`,
                )
              }
            }
          } finally {
            isRunning = false
            if (pendingFlush) {
              pendingFlush = false
              // Schedule on next tick to avoid deep recursion under bursts.
              setImmediate(() => {
                void runNow()
              })
            }
          }
        }

        const unsubscribe = eventBus.subscribeTurnCompleted(async (payload) => {
          // Never reflect the memorize pipeline's own turns back into itself.
          if (payload.threadId === MEMORIZE_THREAD_ID) return

          const turn: SalienceTurn = {
            turnId: payload.turnId,
            threadId: payload.threadId,
            inputText: payload.input,
            outputText: payload.output,
          }

          let verdict
          try {
            verdict = await classifier.classify(turn)
          } catch (err) {
            process.stderr.write(
              `Salience classifier failed: ${String(err)}\n`,
            )
            return
          }

          if (!verdict.noteworthy) return
          await runNow()
        })

        return unsubscribe
      },
    }
  }),
)
