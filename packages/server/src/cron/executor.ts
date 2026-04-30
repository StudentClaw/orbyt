import { readFileSync, existsSync } from "node:fs"
import { Context, Effect, Layer } from "effect"
import type { ActivityFeedEntry, CronJob } from "@orbyt/contracts"
import { CronAgentRunner, HEARTBEAT_THREAD_ID, DAILY_INSIGHT_THREAD_ID } from "./agent-runner.js"
import { ProactiveMemory } from "../proactive/index.js"
import { Database } from "../db/Database.js"
import { PushBus } from "../ws/PushBus.js"
import { CronStore } from "./store.js"
import { CanvasSyncService } from "../canvas/CanvasSyncService.js"
import { createReminderJob } from "./reminder-tool.js"
import { loadInsightContext } from "./insight-context.js"
import {
  buildDailyInsightPrompt,
  buildEveningBriefingPrompt,
  buildHeartbeatPrompt,
  buildMorningBriefingPrompt,
  parseAgentDirectives,
  parseEveningInsight,
  parseInsightOutput,
  parseMorningInsight,
  type InsightSlot,
} from "./prompts.js"
import {
  buildEveningRecapItems,
  detectEveningMode,
  detectMorningMode,
  todayMustDo,
} from "./insight-mode.js"
import type {
  EveningInsightPayload,
  MorningInsightPayload,
} from "@orbyt/contracts"
import { parseHeartbeatProtocol } from "./heartbeat-protocol.js"
import {
  selectHeartbeatCandidates,
  type HeartbeatCandidate,
} from "./heartbeat-candidates.js"
import { recordFire } from "./heartbeat-dedupe.js"
import {
  prioritizeCoursework,
  buildFallbackInsight,
} from "./insight-prioritization.js"
import { recordActivityEntry } from "../activity/feed.js"

export interface ExecutionSuccess {
  readonly status: "success"
  readonly output: string
}

export interface ExecutionFailure {
  readonly status: "failed"
  readonly error: string
}

export type ExecutionResult = ExecutionSuccess | ExecutionFailure

export interface CronExecutorShape {
  readonly run: (job: CronJob) => Promise<ExecutionResult>
}

export class CronExecutor extends Context.Tag("CronExecutor")<
  CronExecutor,
  CronExecutorShape
>() {}

/** Mock executor for tests. */
export const MockCronExecutorLive = Layer.effect(
  CronExecutor,
  Effect.sync(() => ({
    run: async (job) => {
      const summary = `[cron mock] would have run job=${job.id} name=${job.name}`
      process.stdout.write(`${summary}\n`)
      return { status: "success", output: summary }
    },
  })),
)

const NAME_HEARTBEAT = "heartbeat"
const NAME_DAILY_INSIGHT = "daily-insight"
const NAME_CANVAS_SYNC = "canvas-sync"

function safeReadFile(path: string): string {
  if (!existsSync(path)) return ""
  try {
    return readFileSync(path, "utf8")
  } catch {
    return ""
  }
}

function deriveSlot(now: Date): InsightSlot {
  return now.getHours() < 13 ? "morning" : "evening"
}

function highestPriorityFor(
  candidates: ReadonlyArray<HeartbeatCandidate>,
): number {
  if (candidates.some((c) => c.kind === "instant_overdue")) return 1
  if (candidates.some((c) => c.kind === "instant_imminent")) return 2
  return 3
}

/**
 * Production executor.
 *
 *   - reminder              → no-op execution (delivery handles the visible work)
 *   - agentTurn:heartbeat   → backend selects candidates from acute windows;
 *                              if none, returns ok with no LLM call. Otherwise
 *                              prompts the LLM in strict protocol, parses
 *                              INSTANT/SCHEDULE lines, falls back to
 *                              deterministic defaults if the LLM produces
 *                              nothing valid. Writes ActivityFeedEntry rows
 *                              directly and records dedupe state.
 *   - agentTurn:daily-insight → loads context + recap, prioritizes coursework,
 *                                runs the LLM, falls back to a deterministic
 *                                insight if the LLM yields nothing parseable.
 *                                Always writes exactly ONE rich card.
 *   - agentTurn:other       → runs payloadContent against the heartbeat thread
 *   - internalTask:canvas-sync → invokes CanvasSyncService.sync() directly.
 */
export const CronExecutorLive = Layer.effect(
  CronExecutor,
  Effect.gen(function* () {
    const runner = yield* CronAgentRunner
    const memory = yield* ProactiveMemory
    const database = yield* Database
    const pushBus = yield* PushBus
    const store = yield* CronStore
    const canvasSync = yield* CanvasSyncService

    const writeEntry = async (
      entry: Omit<ActivityFeedEntry, "id">,
    ): Promise<void> => {
      await recordActivityEntry({ database, pushBus, entry })
    }

    const recordFiresForCandidates = (
      candidates: ReadonlyArray<HeartbeatCandidate>,
      now: Date,
    ): void => {
      const nowMs = now.getTime()
      for (const c of candidates) {
        recordFire(database, c.itemId, c.state, nowMs)
      }
    }

    const runHeartbeat = async (_job: CronJob): Promise<ExecutionResult> => {
      const now = new Date()
      const ctx = loadInsightContext(database, now)
      const candidates = selectHeartbeatCandidates(database, ctx.upcomingCoursework, now)

      // No candidates — short-circuit, no LLM call.
      if (candidates.length === 0) {
        return { status: "success", output: "heartbeat skipped (no candidates)" }
      }

      const heartbeatScope = safeReadFile(memory.paths.heartbeatFile)
      const notes = memory.listActiveNotes()
      const prompt = buildHeartbeatPrompt({
        heartbeatScope,
        workingBufferNotes: notes,
        nowIso: now.toISOString(),
        candidates,
        todaysSessions: ctx.todaysSessions,
      })

      let raw = ""
      try {
        raw = await runner.run({ threadId: HEARTBEAT_THREAD_ID, prompt })
      } catch (err) {
        // LLM error: stay silent. Better to skip the tick than ship off-tone
        // copy. Candidates remain eligible for the next heartbeat.
        return {
          status: "success",
          output: `heartbeat skipped (LLM error): ${String(err)}`,
        }
      }

      const parsed = parseHeartbeatProtocol(raw)

      if (parsed.decision === "skip") {
        return { status: "success", output: "heartbeat skipped (model SKIP)" }
      }

      await writeEntry({
        category: "cron",
        type: "heartbeat.digest",
        title: "Orby",
        body: parsed.body,
        notify: true,
        priority: highestPriorityFor(candidates),
      })
      recordFiresForCandidates(candidates, now)

      return {
        status: "success",
        output: `heartbeat digest fired (${candidates.length} candidates)`,
      }
    }

    const runDailyInsight = async (job: CronJob): Promise<ExecutionResult> => {
      const now = new Date()
      const slot = deriveSlot(now)
      if (slot === "morning") return runMorningBriefing(job, now)
      return runEveningInsight(job, now)
    }

    const runMorningBriefing = async (
      job: CronJob,
      now: Date,
    ): Promise<ExecutionResult> => {
      const ctx = loadInsightContext(database, now)
      const prioritized = prioritizeCoursework(ctx.upcomingCoursework, now)
      const mode = detectMorningMode(ctx, now)
      const mustDoToday = todayMustDo(ctx.upcomingCoursework, now)

      const prompt = buildMorningBriefingPrompt({
        soul: memory.readSoul(),
        nowIso: now.toISOString(),
        slot: "morning",
        mode,
        mustDoToday,
        recentInsights: ctx.recentInsights,
        upcomingCoursework: prioritized.featured.length > 0
          ? prioritized.featured
          : prioritized.orderedAll,
        todaysSessions: ctx.todaysSessions,
        recap: ctx.recap,
      })

      let raw = ""
      try {
        const cwd = memory.paths.sessionDir(job.id)
        raw = await runner.run({ threadId: DAILY_INSIGHT_THREAD_ID, prompt, cwd })
      } catch (err) {
        await writeMorningFallback(prioritized, ctx, mustDoToday)
        return {
          status: "success",
          output: `daily-insight morning (LLM error, fallback used): ${String(err)}`,
        }
      }

      const parsed = parseMorningInsight(raw)

      for (const reminder of parsed.reminders) {
        const result = createReminderJob(store, reminder)
        if (!result.ok) {
          process.stderr.write(`daily-insight reminder rejected: ${result.reason}\n`)
        }
      }

      if (parsed.payload === null) {
        await writeMorningFallback(prioritized, ctx, mustDoToday)
        return {
          status: "success",
          output: "daily-insight morning (parse failed, fallback used)",
        }
      }

      const payload = parsed.payload
      const deepLink =
        payload.mode === "briefing"
          ? payload.mustDo[0]?.deepLink ?? prioritized.featured[0]?.htmlUrl
          : undefined
      const body = flattenMorningPayload(payload)

      await writeEntry({
        category: "insight",
        type: "daily-insight.morning",
        title: payload.headline,
        body,
        notify: true,
        priority: 3,
        structured: payload,
        ...(deepLink ? { deepLink } : {}),
      })

      return {
        status: "success",
        output: `daily-insight morning ${payload.mode} fired: ${payload.headline}`,
      }
    }

    const writeMorningFallback = async (
      prioritized: ReturnType<typeof prioritizeCoursework>,
      ctx: ReturnType<typeof loadInsightContext>,
      _mustDoToday: ReadonlyArray<unknown>,
    ): Promise<void> => {
      const fb = buildFallbackInsight(prioritized, ctx.recap, "morning")
      await writeEntry({
        category: "insight",
        type: "daily-insight.morning",
        title: fb.title,
        body: fb.body,
        notify: true,
        priority: 3,
        ...(fb.deepLink ? { deepLink: fb.deepLink } : {}),
      })
    }

    const runEveningInsight = async (
      job: CronJob,
      now: Date,
    ): Promise<ExecutionResult> => {
      const ctx = loadInsightContext(database, now)
      const prioritized = prioritizeCoursework(ctx.upcomingCoursework, now)
      const mode = detectEveningMode(ctx, now)
      const recapItems = buildEveningRecapItems(ctx.recap)

      const prompt = buildEveningBriefingPrompt({
        soul: memory.readSoul(),
        nowIso: now.toISOString(),
        slot: "evening",
        mode,
        recapItems,
        recentInsights: ctx.recentInsights,
        upcomingCoursework: prioritized.featured.length > 0
          ? prioritized.featured
          : prioritized.orderedAll,
        todaysSessions: ctx.todaysSessions,
        recap: ctx.recap,
      })

      let raw = ""
      try {
        const cwd = memory.paths.sessionDir(job.id)
        raw = await runner.run({ threadId: DAILY_INSIGHT_THREAD_ID, prompt, cwd })
      } catch (err) {
        await writeEveningFallback(prioritized, ctx)
        return {
          status: "success",
          output: `daily-insight evening (LLM error, fallback used): ${String(err)}`,
        }
      }

      const parsed = parseEveningInsight(raw)
      for (const reminder of parsed.reminders) {
        const result = createReminderJob(store, reminder)
        if (!result.ok) {
          process.stderr.write(`daily-insight reminder rejected: ${result.reason}\n`)
        }
      }

      if (parsed.payload === null) {
        await writeEveningFallback(prioritized, ctx)
        return {
          status: "success",
          output: "daily-insight evening (parse failed, fallback used)",
        }
      }

      const payload = parsed.payload
      const body = flattenEveningPayload(payload)
      const deepLink = prioritized.featured[0]?.htmlUrl

      await writeEntry({
        category: "insight",
        type: "daily-insight.evening",
        title: payload.headline,
        body,
        notify: true,
        priority: 3,
        structured: payload,
        ...(deepLink ? { deepLink } : {}),
      })

      return {
        status: "success",
        output: `daily-insight evening ${payload.mode} fired: ${payload.headline}`,
      }
    }

    const writeEveningFallback = async (
      prioritized: ReturnType<typeof prioritizeCoursework>,
      ctx: ReturnType<typeof loadInsightContext>,
    ): Promise<void> => {
      const fb = buildFallbackInsight(prioritized, ctx.recap, "evening")
      await writeEntry({
        category: "insight",
        type: "daily-insight.evening",
        title: fb.title,
        body: fb.body,
        notify: true,
        priority: 3,
        ...(fb.deepLink ? { deepLink: fb.deepLink } : {}),
      })
    }

    const flattenEveningPayload = (
      payload: EveningInsightPayload,
    ): string => {
      const lines: string[] = []
      if (payload.mode === "briefing") {
        lines.push(payload.recap.summary)
        if (payload.recap.items.length > 0) {
          lines.push(
            payload.recap.items.map((it) => `· ${it.label}`).join("  "),
          )
        }
        lines.push(payload.throughline)
        lines.push(payload.tomorrow)
        if (payload.windDown) lines.push(payload.windDown)
      } else {
        lines.push(payload.throughline)
        if (payload.reflection) lines.push(payload.reflection)
      }
      return lines.join("\n")
    }

    /**
     * Backward-compat: legacy renderers fall back to displaying body text. We
     * derive a flat string version of the structured payload so a client that
     * does not understand the structured field still sees something readable.
     */
    const flattenMorningPayload = (payload: MorningInsightPayload): string => {
      const lines: string[] = []
      if (payload.mode === "briefing") {
        lines.push(payload.anchor)
        for (const item of payload.mustDo) {
          const due = item.dueTime
            ? ` (due ${formatTimeLocal(item.dueTime)})`
            : ""
          lines.push(`Due: ${item.course} ${item.title}${due}`)
        }
        lines.push(payload.lever)
        if (payload.horizon) lines.push(payload.horizon)
      } else {
        lines.push(payload.lever)
        if (payload.reflection) lines.push(payload.reflection)
      }
      return lines.join("\n")
    }

    const formatTimeLocal = (iso: string): string => {
      const d = new Date(iso)
      if (!Number.isFinite(d.getTime())) return iso
      return d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    }

    const runAgentTurnDirect = async (
      job: CronJob,
      threadId: string,
    ): Promise<ExecutionResult> => {
      try {
        const output = await runner.run({ threadId, prompt: job.payloadContent })
        return { status: "success", output: output.trim() }
      } catch (err) {
        return { status: "failed", error: String(err) }
      }
    }

    const runCanvasSync = async (): Promise<ExecutionResult> => {
      try {
        await canvasSync.sync()
        return { status: "success", output: `${NAME_CANVAS_SYNC} ok at ${new Date().toISOString()}` }
      } catch (err) {
        return { status: "failed", error: String(err) }
      }
    }

    return {
      run: async (job) => {
        switch (job.payloadKind) {
          case "reminder":
            return { status: "success", output: job.payloadContent }
          case "agentTurn":
            if (job.name === NAME_HEARTBEAT) return runHeartbeat(job)
            if (job.name === NAME_DAILY_INSIGHT) return runDailyInsight(job)
            return runAgentTurnDirect(job, HEARTBEAT_THREAD_ID)
          case "internalTask":
            if (job.name === NAME_CANVAS_SYNC) return runCanvasSync()
            return {
              status: "failed",
              error: `unknown internalTask name: ${job.name}`,
            }
          default:
            return {
              status: "failed",
              error: `unknown payloadKind: ${String(job.payloadKind)}`,
            }
        }
      },
    }
  }),
)
