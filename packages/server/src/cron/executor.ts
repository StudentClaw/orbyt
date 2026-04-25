import { readFileSync, existsSync } from "node:fs"
import { Context, Effect, Layer } from "effect"
import type { CronJob } from "@orbyt/contracts"
import { CronAgentRunner, HEARTBEAT_THREAD_ID, DAILY_INSIGHT_THREAD_ID } from "./agent-runner.js"
import { ProactiveMemory } from "../proactive/index.js"
import { Database } from "../db/Database.js"
import { CronStore } from "./store.js"
import { createReminderJob } from "./reminder-tool.js"
import { loadInsightContext } from "./insight-context.js"
import {
  buildDailyInsightPrompt,
  buildHeartbeatPrompt,
  parseAgentDirectives,
  parseInsightOutput,
} from "./prompts.js"

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

function safeReadFile(path: string): string {
  if (!existsSync(path)) return ""
  try {
    return readFileSync(path, "utf8")
  } catch {
    return ""
  }
}

/**
 * Production executor.
 *
 *   - reminder              → no-op execution (delivery handles the visible work)
 *   - agentTurn:heartbeat   → builds a heartbeat prompt, runs against synthetic
 *                             thread, parses WB_ADD directives back into the buffer
 *   - agentTurn:daily-insight → runs the job's payloadContent verbatim against
 *                               the insight thread (prompt is wired in step 5)
 *   - agentTurn:other       → runs payloadContent against the heartbeat thread
 */
export const CronExecutorLive = Layer.effect(
  CronExecutor,
  Effect.gen(function* () {
    const runner = yield* CronAgentRunner
    const memory = yield* ProactiveMemory
    const database = yield* Database
    const store = yield* CronStore

    const runHeartbeat = async (job: CronJob): Promise<ExecutionResult> => {
      const heartbeatScope = safeReadFile(memory.paths.heartbeatFile)
      const notes = memory.listActiveNotes()
      const prompt = buildHeartbeatPrompt({
        heartbeatScope,
        workingBufferNotes: notes,
        nowIso: new Date().toISOString(),
      })

      try {
        const raw = await runner.run({ threadId: HEARTBEAT_THREAD_ID, prompt })
        const directives = parseAgentDirectives(raw)
        for (const note of directives.notes) {
          try {
            memory.addNote({ text: note.text, ttlHours: note.ttlHours })
          } catch (err) {
            process.stderr.write(`heartbeat WB_ADD rejected: ${String(err)}\n`)
          }
        }
        return { status: "success", output: directives.cleanedReply || raw.trim() }
      } catch (err) {
        return { status: "failed", error: String(err) }
      }
    }

    const runDailyInsight = async (job: CronJob): Promise<ExecutionResult> => {
      try {
        const ctx = loadInsightContext(database)
        const prompt = buildDailyInsightPrompt({
          soul: memory.readSoul(),
          nowIso: new Date().toISOString(),
          recentInsights: ctx.recentInsights,
          upcomingCoursework: ctx.upcomingCoursework,
          todaysSessions: ctx.todaysSessions,
        })
        const cwd = memory.paths.sessionDir(job.id)
        const raw = await runner.run({ threadId: DAILY_INSIGHT_THREAD_ID, prompt, cwd })
        const parsed = parseInsightOutput(raw)

        for (const reminder of parsed.reminders) {
          const result = createReminderJob(store, reminder)
          if (!result.ok) {
            process.stderr.write(`daily-insight reminder rejected: ${result.reason}\n`)
          }
        }

        const headline = parsed.insights.length > 0
          ? parsed.insights
            .map((i) => `${i.title} — ${i.body}`)
            .join("\n")
          : raw.trim()
        return { status: "success", output: headline }
      } catch (err) {
        return { status: "failed", error: String(err) }
      }
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

    return {
      run: async (job) => {
        switch (job.payloadKind) {
          case "reminder":
            return { status: "success", output: job.payloadContent }
          case "agentTurn":
            if (job.name === NAME_HEARTBEAT) return runHeartbeat(job)
            if (job.name === NAME_DAILY_INSIGHT) return runDailyInsight(job)
            return runAgentTurnDirect(job, HEARTBEAT_THREAD_ID)
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
