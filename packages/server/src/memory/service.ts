import { Context, Effect, Layer } from "effect"
import type { MemorizeRunResult } from "@student-claw/contracts"
import { ConfigService } from "../config/ConfigService.js"
import { Database } from "../db/Database.js"
import { CodexCli } from "../ai/CodexCli.js"
import { createMemoryPaths } from "./paths.js"
import { MemorizeStateStore } from "./state-store.js"
import { CodexMemorizeDistiller, MEMORIZE_THREAD_ID } from "./distiller.js"
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

    // Seed a synthetic orchestration thread for the Memorize pipeline so that
    // CodexCli.streamTurn can upsert provider_runtime_sessions without hitting
    // the FK to orchestration_threads(id). This thread is internal-only and is
    // never surfaced to the UI (filtered out in snapshots).
    const nowIso = new Date().toISOString()
    db.execute(
      `INSERT OR IGNORE INTO orchestration_threads
         (id, workspace_id, title, access_mode, status, current_turn_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      [MEMORIZE_THREAD_ID, "workspace_legacy", "Memorize (system)", "default", "idle", nowIso, nowIso],
    )

    let isRunning = false

    return {
      runIfNeeded: async (now: Date) => {
        if (isRunning) {
          return { ran: false, result: null }
        }

        // Read state inside the lock so we never act on a stale lastRunAt
        // from before a completed prior run.
        isRunning = true
        try {
          const state = store.read()

          if (!memorizeRunNeeded(state.lastRunAt, now)) {
            return { ran: false, result: null }
          }

          const activeTurns = db.query<ActiveTurnRow>(
            `SELECT COUNT(*) as cnt FROM orchestration_turns WHERE status = 'streaming'`,
          )
          if ((activeTurns[0]?.cnt ?? 0) > 0) {
            return { ran: false, result: null }
          }

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
