import { mkdirSync, existsSync, readFileSync } from "node:fs"
import type { MemorizeRunError, MemorizeRunResult } from "@orbyt/contracts"
import type { DatabaseService } from "../db/Database.js"
import type { MemorizeTurnInput, MemorizeTurnRunner } from "./runner.js"
import type { MemoryPaths } from "./paths.js"
import type { MemorizeStateStore } from "./state-store.js"
import type { MemorizeDistiller } from "./distiller.js"
import {
  readTurnsSince,
  readTurnsForDay,
  buildCursor,
  formatTurnsForPrompt,
} from "./turn-reader.js"
import {
  writeDailyFile,
  readDailyFile,
  appendRecapBlock,
} from "./daily-writer.js"
import { enforceRetention } from "./pruner.js"
import { weekKeyForDailyDate } from "./weekly-writer.js"
import { isoWeekKey, isoDateKey } from "./week.js"
import {
  fillTemplate,
  DAILY_DISTILLATION_PROMPT,
  END_OF_DAY_RECAP_PROMPT,
} from "./prompts/index.js"
import { runPromotion } from "./promoter.js"
import { readCourseContext } from "./course-reader.js"
import { appendMemorizeError } from "./error-log.js"

function previousDayStartEndIso(now: Date): {
  readonly dateKey: string
  readonly startIso: string
  readonly endIso: string
} {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  start.setDate(start.getDate() - 1)
  return {
    dateKey: isoDateKey(start),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

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
    const { sinceCursor, now, trigger } = input
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

      // End-of-day recap pass — only on explicit recap triggers.
      // Reads the full previous local day and appends (or replaces) a single
      // "## End-of-Day Recap" block in that day's daily file.
      let recapFileWritten: string | null = null
      if (trigger === "recap") {
        const { dateKey: recapDate, startIso, endIso } =
          previousDayStartEndIso(now)
        const dayTurns = readTurnsForDay(db, startIso, endIso)
        if (dayTurns.length > 0) {
          const recapPrompt = fillTemplate(END_OF_DAY_RECAP_PROMPT, {
            date: recapDate,
            thread_turns: formatTurnsForPrompt(dayTurns),
          })
          const recapOutput = await distiller.distill(recapPrompt)
          recapFileWritten = appendRecapBlock(paths, recapDate, recapOutput)
        }
      }

      // Rollover gate: only fold daily -> weekly once per calendar day.
      const shouldRollover = state.lastRolloverDate !== dateKey
      const { prunedDaily } = shouldRollover
        ? await enforceRetention(paths, distiller)
        : { prunedDaily: [] as string[] }

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
      const nowIso = now.toISOString()

      store.commitSuccess({
        lastRunAt: nowIso,
        lastProcessedThreadCursor: newCursor,
        lastDailyFile: dailyFileWritten ?? state.lastDailyFile,
        lastWeeklyFile: weeklyFileWritten ?? state.lastWeeklyFile,
        lastRolloverDate: shouldRollover ? dateKey : state.lastRolloverDate,
        lastAutoRunAt: trigger === "auto" ? nowIso : state.lastAutoRunAt,
        pendingPromotionCandidates: promotion.updatedPending,
        promotedCandidateFingerprints: promotion.updatedFingerprints,
      })

      return {
        ok: true,
        result: {
          dailyFileWritten,
          weeklyFileWritten,
          recapFileWritten,
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
