import { Context, Effect, Layer } from "effect"
import { existsSync, readdirSync } from "node:fs"
import type { MemorizeRunResult, MemorizeRunTrigger } from "@orbyt/contracts"
import { ConfigService } from "../config/ConfigService.js"
import { Database } from "../db/Database.js"
import { CodexCli } from "../ai/CodexCli.js"
import { createMemoryPaths } from "./paths.js"
import { MemorizeStateStore } from "./state-store.js"
import { CodexMemorizeDistiller, MEMORIZE_THREAD_ID, MEMORIZE_SALIENCE_THREAD_ID } from "./distiller.js"
import { LiveMemorizeTurnRunner } from "./live-runner.js"
import { memorizeRunNeeded } from "./timer.js"
import { markStaleCourseNodes } from "./node-curator.js"
import { appendMemorizeError } from "./error-log.js"
import { ensureGraphScaffold } from "./graph-writer.js"

type ActiveTurnRow = { cnt: number }
type MemoryGraphPreferenceRow = { memory_graph_path: string | null }

function isGraphFolderEmpty(graphDir: string): boolean {
  if (!existsSync(graphDir)) return true
  return readdirSync(graphDir).length === 0
}

export interface MemorizeRunOptions {
  readonly trigger?: MemorizeRunTrigger
}

export interface MemorizeServiceShape {
  readonly runIfNeeded: (
    now: Date,
    options?: MemorizeRunOptions,
  ) => Promise<{
    ran: boolean
    trigger: MemorizeRunTrigger
    result: MemorizeRunResult | null
  }>
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

    const distiller = new CodexMemorizeDistiller(codex)

    // Seed synthetic orchestration threads for the Memorize pipeline so that
    // CodexCli.streamTurn can upsert provider_runtime_sessions without hitting
    // the FK to orchestration_threads(id). These threads are internal-only and
    // never surfaced to the UI (filtered out in snapshots).
    const nowIso = new Date().toISOString()
    for (const [id, title] of [
      [MEMORIZE_THREAD_ID, "Memorize (system)"],
      [MEMORIZE_SALIENCE_THREAD_ID, "Memorize salience (system)"],
    ] as const) {
      db.execute(
        `INSERT OR IGNORE INTO orchestration_threads
           (id, workspace_id, title, access_mode, status, current_turn_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
        [id, "workspace_legacy", title, "default", "idle", nowIso, nowIso],
      )
    }

    let isRunning = false

    const resolvePaths = () => {
      const row = db.get<MemoryGraphPreferenceRow>(
        "SELECT memory_graph_path FROM user_preferences WHERE id = 1",
      )
      return createMemoryPaths({
        env: process.env,
        graphDirOverride: row?.memory_graph_path ?? null,
      })
    }

    return {
      runIfNeeded: async (now: Date, options?: MemorizeRunOptions) => {
        const trigger: MemorizeRunTrigger = options?.trigger ?? "manual"
        if (isRunning) {
          return { ran: false, trigger, result: null }
        }

        // Read state inside the lock so we never act on a stale lastRunAt
        // from before a completed prior run.
        isRunning = true
        const paths = resolvePaths()
        const store = new MemorizeStateStore(paths)
        const runner = new LiveMemorizeTurnRunner({ db, paths, store, distiller })
        try {
          const state = store.read()
          const graphFolderEmpty = isGraphFolderEmpty(paths.graphDir)

          // "auto" and "recap" triggers are authoritative — always run them.
          // "manual" still respects the staleness check so accidental manual
          // re-triggers don't redo work.
          const forceRun = trigger === "auto" || trigger === "recap"
          if (!forceRun && !memorizeRunNeeded(state.lastRunAt, now, graphFolderEmpty)) {
            return { ran: false, trigger, result: null }
          }

          const scaffoldedGraphNodes = graphFolderEmpty
            ? ensureGraphScaffold(paths)
            : []

          const activeTurns = db.query<ActiveTurnRow>(
            `SELECT COUNT(*) as cnt FROM orchestration_turns WHERE status = 'streaming'`,
          )
          if ((activeTurns[0]?.cnt ?? 0) > 0) {
            return {
              ran: scaffoldedGraphNodes.length > 0,
              trigger,
              result: scaffoldedGraphNodes.length > 0
                ? {
                    dailyFileWritten: null,
                    weeklyFileWritten: null,
                    recapFileWritten: null,
                    graphNodesUpdated: scaffoldedGraphNodes,
                  }
                : null,
            }
          }

          const sinceCursor = state.lastProcessedThreadCursor
          const outcome = await runner.run({ sinceCursor, now, trigger })

          if (outcome.ok) {
            try {
              markStaleCourseNodes(paths, db, now)
            } catch (err) {
              appendMemorizeError(paths, "service.markStaleCourseNodes", err)
            }
          }

          return {
            ran: true,
            trigger,
            result: outcome.ok
              ? {
                  ...outcome.result,
                  graphNodesUpdated: [
                    ...scaffoldedGraphNodes,
                    ...outcome.result.graphNodesUpdated,
                  ],
                }
              : null,
          }
        } catch (err) {
          appendMemorizeError(paths, "service.runIfNeeded", err)
          return { ran: true, trigger, result: null }
        } finally {
          isRunning = false
        }
      },
    }
  }),
)
