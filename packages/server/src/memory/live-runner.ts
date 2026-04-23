import { mkdirSync, existsSync, readFileSync } from "node:fs"
import type { MemorizeRunError, MemorizeRunResult } from "@orbyt/contracts"
import type { DatabaseService } from "../db/Database.js"
import type { MemorizeTurnInput, MemorizeTurnRunner } from "./runner.js"
import type { MemoryPaths } from "./paths.js"
import type { MemorizeStateStore } from "./state-store.js"
import type { MemorizeDistiller } from "./distiller.js"
import { readTurnsSince, buildCursor, formatTurnsForPrompt } from "./turn-reader.js"
import { writeDailyFile, readDailyFile } from "./daily-writer.js"
import { enforceRetention } from "./pruner.js"
import { weekKeyForDailyDate } from "./weekly-writer.js"
import { isoWeekKey, isoDateKey } from "./week.js"
import { fillTemplate, DAILY_DISTILLATION_PROMPT } from "./prompts/index.js"
import { runPromotion } from "./promoter.js"
import { readCourseContext } from "./course-reader.js"
import { appendMemorizeError } from "./error-log.js"

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
    const state = store.read()

    try {
      mkdirSync(paths.dailyDir, { recursive: true })
      mkdirSync(paths.weeklyDir, { recursive: true })

      const turns = readTurnsSince(db, sinceCursor)
      const newCursor = turns.length > 0 ? buildCursor(turns) : sinceCursor

      const dateKey = isoDateKey(now)
      let dailyFileWritten: string | null = null
      let dailyContent: string | null = null

      const todayFileExists = existsSync(paths.dailyFile(dateKey))
      // On recovery, we don't re-parse the daily file for promotion candidates —
      // they were already (partially) processed in the prior run. Passing null
      // prevents evidenceCount from inflating on every crash-recovery cycle.
      const isRecovery = todayFileExists

      if (isRecovery) {
        // Recovery path: a previous run wrote the daily file but failed before commitSuccess.
        // Re-use existing content without re-feeding it to the promoter.
        dailyContent = readDailyFile(paths, dateKey)
        dailyFileWritten = dateKey
      } else if (turns.length > 0) {
        // Normal path: distill new turns and write the daily file.
        const courses = readCourseContext(db)
        const prompt = fillTemplate(DAILY_DISTILLATION_PROMPT, {
          courses,
          date: dateKey,
          thread_turns: formatTurnsForPrompt(turns),
        })
        dailyContent = await distiller.distill(prompt)
        dailyFileWritten = writeDailyFile(paths, dailyContent, now)
      }

      const { prunedDaily } = await enforceRetention(paths, distiller)

      const updatedWeeklyPaths = new Set(
        prunedDaily.map((key) => paths.weeklyFile(weekKeyForDailyDate(key))),
      )
      const weeklyContent =
        [...updatedWeeklyPaths]
          .filter((p) => existsSync(p))
          .map((p) => readFileSync(p, "utf-8"))
          .join("\n\n") || null

      // On recovery, don't re-parse the existing daily file — candidates were already queued.
      const promotionDailyContent = isRecovery ? null : dailyContent
      const promotion = await runPromotion(paths, state, promotionDailyContent, weeklyContent, now)

      const weeklyFileWritten = prunedDaily.length > 0 ? isoWeekKey(now) : null

      store.commitSuccess({
        lastRunAt: now.toISOString(),
        lastProcessedThreadCursor: newCursor,
        lastDailyFile: dailyFileWritten ?? state.lastDailyFile,
        lastWeeklyFile: weeklyFileWritten ?? state.lastWeeklyFile,
        pendingPromotionCandidates: promotion.updatedPending,
        promotedCandidateFingerprints: promotion.updatedFingerprints,
      })

      return {
        ok: true,
        result: {
          dailyFileWritten,
          weeklyFileWritten,
          graphNodesUpdated: promotion.promoted,
        },
      }
    } catch (err) {
      appendMemorizeError(paths, "live-runner.run", err)
      store.recordFailure()
      return {
        ok: false,
        error: {
          type: "runner_failed",
          message: "Memory distillation failed. See memorize-error.log for details.",
        },
      }
    }
  }
}
