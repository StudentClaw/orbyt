import { Context, Effect, Layer } from "effect"
import { createId } from "@orbyt/shared-runtime"
import { CodexCli } from "../ai/CodexCli.js"
import { Database } from "../db/Database.js"
import { ProactiveMemory } from "../proactive/index.js"

export const HEARTBEAT_THREAD_ID = "thread_cron_heartbeat"
export const DAILY_INSIGHT_THREAD_ID = "thread_cron_daily_insight"

const SYNTHETIC_THREAD_IDS = [HEARTBEAT_THREAD_ID, DAILY_INSIGHT_THREAD_ID] as const

export interface AgentTurnInput {
  readonly threadId: string
  readonly prompt: string
  readonly cwd?: string | null
}

export interface CronAgentRunnerShape {
  readonly run: (input: AgentTurnInput) => Promise<string>
}

export class CronAgentRunner extends Context.Tag("CronAgentRunner")<
  CronAgentRunner,
  CronAgentRunnerShape
>() {}

/**
 * Runs an agent turn against a synthetic thread the user never sees. Output is
 * collected and returned as a single string. Modeled on
 * `CodexMemorizeDistiller`: same shape, different thread id and slightly
 * larger surface (we accept a per-call cwd for isolated session jobs).
 */
export const CronAgentRunnerLive = Layer.effect(
  CronAgentRunner,
  Effect.gen(function* () {
    const codex = yield* CodexCli
    const db = yield* Database
    const memory = yield* ProactiveMemory

    // Synthetic threads need rows in orchestration_threads to satisfy the FK
    // from provider_runtime_sessions. Seed on layer init; idempotent.
    const nowIso = new Date().toISOString()
    for (const id of SYNTHETIC_THREAD_IDS) {
      db.execute(
        `INSERT OR IGNORE INTO orchestration_threads
           (id, workspace_id, title, access_mode, status, current_turn_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
        [id, "workspace_legacy", `Cron (${id})`, "default", "idle", nowIso, nowIso],
      )
    }

    const run: CronAgentRunnerShape["run"] = async (input) => {
      const turnId = createId("cron-turn")
      let output = ""

      await new Promise<void>((resolve, reject) => {
        void codex.streamTurn({
          localThreadId: input.threadId,
          localTurnId: turnId,
          content: input.prompt,
          cwd: input.cwd ?? null,
          studentState: memory.readSoul(),
          onToken: async (token) => {
            output += token
          },
          onReasoning: async () => {},
          onCompleted: async () => resolve(),
          onInterrupted: async () =>
            reject(new Error("cron agent turn interrupted")),
          onError: async (err) =>
            reject(new Error(`cron agent turn failed: ${err.message}`)),
          onMcpToolCall: async () => {},
          onApprovalRequest: async () => {},
        })
      })

      return output
    }

    return { run }
  }),
)
