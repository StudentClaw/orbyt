import { mkdirSync } from "node:fs"
import type { MemorizeRunError, MemorizeRunResult } from "@student-claw/contracts"
import type { DatabaseService } from "../db/Database.js"
import type { MemorizeTurnInput, MemorizeTurnRunner } from "./runner.js"
import type { MemoryPaths } from "./paths.js"
import type { MemorizeStateStore } from "./state-store.js"
import type { MemorizeDistiller } from "./distiller.js"
import { readTurnsSince, buildCursor, formatTurnsForPrompt } from "./turn-reader.js"
import { writeDailyFile } from "./daily-writer.js"
import { enforceRetention } from "./pruner.js"
import { isoWeekKey, isoDateKey } from "./week.js"
import { fillTemplate, DAILY_DISTILLATION_PROMPT } from "./prompts/index.js"

export interface LiveMemorizeTurnRunnerDeps {
  readonly db: DatabaseService
  readonly paths: MemoryPaths
  readonly store: MemorizeStateStore
  readonly distiller: MemorizeDistiller
}

export class LiveMemorizeTurnRunner implements MemorizeTurnRunner {
  constructor(private readonly deps: LiveMemorizeTurnRunnerDeps) {}

  async run(input: MemorizeTurnInput): Promise<
    | { readonly ok: true; readonly result: MemorizeRunResult }
    | { readonly ok: false; readonly error: MemorizeRunError }
  > {
    const { db, paths, store, distiller } = this.deps
    const { sinceCursor, now } = input

    try {
      mkdirSync(paths.dailyDir, { recursive: true })
      mkdirSync(paths.weeklyDir, { recursive: true })

      const turns = readTurnsSince(db, sinceCursor)
      const newCursor = turns.length > 0 ? buildCursor(turns) : sinceCursor

      const dateKey = isoDateKey(now)
      let dailyFileWritten: string | null = null

      if (turns.length > 0) {
        const prompt = fillTemplate(DAILY_DISTILLATION_PROMPT, {
          date: dateKey,
          thread_turns: formatTurnsForPrompt(turns),
        })
        const aiOutput = await distiller.distill(prompt)
        dailyFileWritten = writeDailyFile(paths, aiOutput, now)
      }

      const { prunedDaily } = await enforceRetention(paths, distiller)

      const weeklyFileWritten = isoWeekKey(now)

      store.commitSuccess({
        lastRunAt: now.toISOString(),
        lastProcessedThreadCursor: newCursor,
        lastDailyFile: dailyFileWritten ?? store.read().lastDailyFile,
        lastWeeklyFile: weeklyFileWritten,
        pendingPromotionCandidates: store.read().pendingPromotionCandidates,
      })

      return {
        ok: true,
        result: {
          dailyFileWritten,
          weeklyFileWritten: prunedDaily.length > 0 ? weeklyFileWritten : null,
          graphNodesUpdated: [],
        },
      }
    } catch (err) {
      store.recordFailure()
      return {
        ok: false,
        error: {
          type: "runner_failed",
          message: err instanceof Error ? err.message : String(err),
        },
      }
    }
  }
}
