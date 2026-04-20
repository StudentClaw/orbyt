import { Context, Effect, Layer } from "effect"
import type { MemorizeRunResult } from "@student-claw/contracts"
import { ConfigService } from "../config/ConfigService.js"
import { Database } from "../db/Database.js"
import { CodexCli } from "../ai/CodexCli.js"
import { createMemoryPaths } from "./paths.js"
import { MemorizeStateStore } from "./state-store.js"
import { CodexMemorizeDistiller } from "./distiller.js"
import { LiveMemorizeTurnRunner } from "./live-runner.js"
import { memorizeRunNeeded } from "./timer.js"
import { markStaleCourseNodes } from "./node-curator.js"
import { appendMemorizeError } from "./error-log.js"

type ActiveTurnRow = { cnt: number }

export interface MemorizeServiceShape {
  readonly runIfNeeded: (now: Date) => Promise<{ ran: boolean; result: MemorizeRunResult | null }>
}

export class MemorizeService extends Context.Tag("MemorizeService")<
  MemorizeService,
  MemorizeServiceShape
>() {}

export const MemorizeServiceLive = Layer.effect(
  MemorizeService,
  Effect.gen(function* () {
    yield* ConfigService
    const db = yield* Database
    const codex = yield* CodexCli

    const paths = createMemoryPaths({ env: process.env })
    const store = new MemorizeStateStore(paths)
    const distiller = new CodexMemorizeDistiller(codex)
    const runner = new LiveMemorizeTurnRunner({ db, paths, store, distiller })

    let isRunning = false

    return {
      runIfNeeded: async (now: Date) => {
        const state = store.read()

        if (!memorizeRunNeeded(state.lastRunAt, now)) {
          return { ran: false, result: null }
        }

        if (isRunning) {
          return { ran: false, result: null }
        }

        const activeTurns = db.query<ActiveTurnRow>(
          `SELECT COUNT(*) as cnt FROM orchestration_turns WHERE status = 'streaming'`,
        )
        if ((activeTurns[0]?.cnt ?? 0) > 0) {
          appendMemorizeError(
            paths,
            "service.runIfNeeded",
            new Error("Deferred: active chat session in progress"),
          )
          return { ran: false, result: null }
        }

        isRunning = true
        try {
          const sinceCursor = state.lastProcessedThreadCursor
          const outcome = await runner.run({ sinceCursor, now })

          if (outcome.ok) {
            try {
              markStaleCourseNodes(paths, db, now)
            } catch (err) {
              appendMemorizeError(paths, "service.markStaleCourseNodes", err)
            }
          }

          return { ran: true, result: outcome.ok ? outcome.result : null }
        } catch (err) {
          appendMemorizeError(paths, "service.runIfNeeded", err)
          return { ran: true, result: null }
        } finally {
          isRunning = false
        }
      },
    }
  }),
)
