import { Context, Layer, Effect } from "effect"
import {
  PUSH_CHANNELS,
  type DesktopBootstrap,
  type InterruptTurnResult,
  type OrchestrationDomainEvent,
  type OrchestrationSnapshot,
  type ServerConfig,
  type OrchestrationThread,
  type OrchestrationTurn,
  type ProviderRuntimeEvent,
  type CreateThreadResult,
  type SendTurnResult,
} from "@student-claw/contracts"
import { createId, sleepMs } from "@student-claw/shared-runtime"
import { ConfigService } from "../config/ConfigService.js"
import { Database } from "../db/Database.js"
import { ServerReadiness } from "../runtime/ServerReadiness.js"
import { PushBus } from "../ws/PushBus.js"
import { RuntimeReceiptBus } from "./RuntimeReceiptBus.js"
import { tokenizeStubResponse } from "./StubProvider.js"

type ThreadRow = {
  id: string
  title: string
  status: OrchestrationThread["status"]
  current_turn_id: string | null
  created_at: string
}

type TurnRow = {
  id: string
  thread_id: string
  input_text: string
  output_text: string
  status: OrchestrationTurn["status"]
  started_at: string
  completed_at: string | null
}

type WorkItem = {
  commandId: string
  threadId: string
  turnId: string
  content: string
}

export interface OrchestrationServiceShape {
  readonly getDesktopBootstrap: () => Promise<DesktopBootstrap>
  readonly getServerConfig: () => Promise<ServerConfig>
  readonly getSnapshot: () => Promise<OrchestrationSnapshot>
  readonly createThread: (commandId: string, title?: string) => Promise<CreateThreadResult>
  readonly sendTurn: (commandId: string, threadId: string, content: string) => Promise<SendTurnResult>
  readonly interruptTurn: (commandId: string, threadId: string) => Promise<InterruptTurnResult>
}

export class OrchestrationService extends Context.Tag("OrchestrationService")<
  OrchestrationService,
  OrchestrationServiceShape
>() {}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null
  return JSON.parse(value) as T
}

export const OrchestrationServiceLive = Layer.scoped(
  OrchestrationService,
  Effect.gen(function* () {
    const config = yield* ConfigService
    const database = yield* Database
    const pushBus = yield* PushBus
    const readiness = yield* ServerReadiness
    const receiptBus = yield* RuntimeReceiptBus
    const activeTurns = new Map<string, { interrupted: boolean }>()
    const workQueue: WorkItem[] = []
    let drainingQueue = false

    const appendEvent = (
      eventType: string,
      payload: unknown,
      refs: { threadId?: string; turnId?: string; commandId?: string } = {},
    ): number => {
      database.execute(
        `INSERT INTO orchestration_events (event_type, thread_id, turn_id, command_id, payload)
         VALUES (?, ?, ?, ?, ?)`,
        [
          eventType,
          refs.threadId ?? null,
          refs.turnId ?? null,
          refs.commandId ?? null,
          JSON.stringify(payload),
        ],
      )
      const row = database.get<{ sequence: number }>(
        `SELECT sequence FROM orchestration_events ORDER BY sequence DESC LIMIT 1`,
      )
      return row?.sequence ?? 0
    }

    const recordReceipt = (commandId: string, status: string, payload: unknown): void => {
      database.execute(
        `INSERT OR REPLACE INTO command_receipts (command_id, status, payload, created_at)
         VALUES (?, ?, ?, ?)`,
        [commandId, status, JSON.stringify(payload), new Date().toISOString()],
      )
    }

    const readThread = (threadId: string): OrchestrationThread | null => {
      const row = database.get<ThreadRow>(
        `SELECT id, title, status, current_turn_id, created_at
         FROM orchestration_threads
         WHERE id = ?`,
        [threadId],
      )
      if (!row) return null
      return {
        id: row.id as OrchestrationThread["id"],
        title: row.title,
        status: row.status,
        createdAt: row.created_at,
        currentTurnId: row.current_turn_id as OrchestrationThread["currentTurnId"],
      }
    }

    const readTurn = (turnId: string): OrchestrationTurn | null => {
      const row = database.get<TurnRow>(
        `SELECT id, thread_id, input_text, output_text, status, started_at, completed_at
         FROM orchestration_turns
         WHERE id = ?`,
        [turnId],
      )
      if (!row) return null
      return {
        id: row.id as OrchestrationTurn["id"],
        threadId: row.thread_id as OrchestrationTurn["threadId"],
        input: row.input_text,
        output: row.output_text,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
      }
    }

    const publishDomainEvent = async (event: OrchestrationDomainEvent): Promise<void> => {
      await pushBus.publish(PUSH_CHANNELS.ORCHESTRATION_DOMAIN, event)
    }

    const publishRuntimeEvent = async (event: ProviderRuntimeEvent): Promise<void> => {
      await pushBus.publish(PUSH_CHANNELS.PROVIDER_RUNTIME, event)
    }

    const reconcileStaleStreamingState = (): void => {
      const now = new Date().toISOString()
      database.transaction(() => {
        database.execute(
          `UPDATE orchestration_turns
           SET status = 'interrupted',
               completed_at = COALESCE(completed_at, ?),
               updated_at = ?
           WHERE status = 'streaming'`,
          [now, now],
        )
        database.execute(
          `UPDATE orchestration_threads
           SET status = 'interrupted',
               current_turn_id = NULL,
               updated_at = ?
           WHERE status = 'streaming'`,
          [now],
        )
        database.execute(
          `UPDATE provider_runtime_sessions
           SET status = 'interrupted',
               updated_at = ?
           WHERE status = 'streaming'`,
          [now],
        )
      })
    }

    const completeTurn = async (
      commandId: string,
      threadId: string,
      turnId: string,
      output: string,
      interrupted: boolean,
    ): Promise<void> => {
      const completedAt = new Date().toISOString()
      const turnStatus = interrupted ? "interrupted" : "completed"

      database.transaction(() => {
        database.execute(
          `UPDATE orchestration_turns
           SET output_text = ?, status = ?, completed_at = ?, updated_at = ?
           WHERE id = ?`,
          [output, turnStatus, completedAt, completedAt, turnId],
        )
        database.execute(
          `UPDATE orchestration_threads
           SET status = ?, current_turn_id = NULL, updated_at = ?
           WHERE id = ?`,
          [turnStatus, completedAt, threadId],
        )
        database.execute(
          `INSERT OR REPLACE INTO provider_runtime_sessions (thread_id, provider, status, last_error, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [threadId, "stub", interrupted ? "interrupted" : "idle", null, completedAt],
        )
      })

      const turn = readTurn(turnId)
      if (!turn) return

      if (interrupted) {
        appendEvent("turn.interrupted", { turn }, { threadId, turnId, commandId })
        recordReceipt(commandId, "interrupted", { turnId, threadId })
        await publishRuntimeEvent({
          type: "provider.turnInterrupted",
          threadId: threadId as ProviderRuntimeEvent["threadId"],
          turnId: turnId as ProviderRuntimeEvent["turnId"],
        })
        await publishDomainEvent({ type: "turn.interrupted", turn })
      } else {
        appendEvent("turn.completed", { turn }, { threadId, turnId, commandId })
        recordReceipt(commandId, "completed", { turnId, threadId })
        await publishRuntimeEvent({
          type: "provider.turnCompleted",
          threadId: threadId as ProviderRuntimeEvent["threadId"],
          turnId: turnId as ProviderRuntimeEvent["turnId"],
          output,
        })
        await publishDomainEvent({ type: "turn.completed", turn })
      }

      await receiptBus.resolve(commandId, { turnId, threadId, status: turnStatus })
      activeTurns.delete(turnId)
    }

    const processWork = async (work: WorkItem): Promise<void> => {
      try {
        const tokens = tokenizeStubResponse(work.content)
        let output = ""

        for (const [index, token] of tokens.entries()) {
          if (activeTurns.get(work.turnId)?.interrupted) {
            await completeTurn(work.commandId, work.threadId, work.turnId, output, true)
            return
          }

          await sleepMs(45)
          output += token

          database.execute(
            `UPDATE orchestration_turns
             SET output_text = ?, updated_at = ?
             WHERE id = ?`,
            [output, new Date().toISOString(), work.turnId],
          )

          await publishRuntimeEvent({
            type: "provider.token",
            threadId: work.threadId as ProviderRuntimeEvent["threadId"],
            turnId: work.turnId as ProviderRuntimeEvent["turnId"],
            token,
            index,
          })

          const turn = readTurn(work.turnId)
          if (turn) {
            appendEvent("turn.updated", { turn }, {
              threadId: work.threadId,
              turnId: work.turnId,
              commandId: work.commandId,
            })
            await publishDomainEvent({ type: "turn.updated", turn })
          }
        }

        await completeTurn(work.commandId, work.threadId, work.turnId, output, false)
      } catch (error) {
        const now = new Date().toISOString()
        database.transaction(() => {
          database.execute(
            `UPDATE orchestration_turns
             SET status = 'interrupted', completed_at = ?, updated_at = ?
             WHERE id = ?`,
            [now, now, work.turnId],
          )
          database.execute(
            `UPDATE orchestration_threads
             SET status = 'interrupted', current_turn_id = NULL, updated_at = ?
             WHERE id = ?`,
            [now, work.threadId],
          )
          database.execute(
            `INSERT OR REPLACE INTO provider_runtime_sessions (thread_id, provider, status, last_error, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
              work.threadId,
              "stub",
              "interrupted",
              error instanceof Error ? error.message : "Unknown orchestration error",
              now,
            ],
          )
        })
        activeTurns.delete(work.turnId)
      }
    }

    const drainQueue = async (): Promise<void> => {
      if (drainingQueue) {
        return
      }

      drainingQueue = true
      try {
        while (workQueue.length > 0) {
          const next = workQueue.shift()
          if (!next) {
            continue
          }
          await processWork(next)
        }
      } finally {
        drainingQueue = false
        if (workQueue.length > 0) {
          void drainQueue()
        }
      }
    }

    reconcileStaleStreamingState()

    return {
      getDesktopBootstrap: async () => ({
        wsUrl: `ws://127.0.0.1:${config.port}`,
        appVersion: "0.1.0",
        platform: process.platform,
      }),
      getServerConfig: async () => ({
        appVersion: "0.1.0",
        platform: process.platform,
        protocolVersion: "rpc-v1",
        capabilities: {
          orchestration: true,
          providerRuntime: true,
          desktopBootstrap: true,
        },
      }),
      getSnapshot: async () => {
        const threads = database.query<ThreadRow>(
          `SELECT id, title, status, current_turn_id, created_at
           FROM orchestration_threads
           ORDER BY created_at ASC`,
        ).map((row) => ({
          id: row.id as OrchestrationThread["id"],
          title: row.title,
          status: row.status,
          createdAt: row.created_at,
          currentTurnId: row.current_turn_id as OrchestrationThread["currentTurnId"],
        }))
        const turns = database.query<TurnRow>(
          `SELECT id, thread_id, input_text, output_text, status, started_at, completed_at
           FROM orchestration_turns
           ORDER BY started_at ASC`,
        ).map((row) => ({
          id: row.id as OrchestrationTurn["id"],
          threadId: row.thread_id as OrchestrationTurn["threadId"],
          input: row.input_text,
          output: row.output_text,
          status: row.status,
          startedAt: row.started_at,
          completedAt: row.completed_at,
        }))
        const provider = database.get<{ status: OrchestrationSnapshot["providerStatus"] }>(
          `SELECT status FROM provider_runtime_sessions ORDER BY updated_at DESC LIMIT 1`,
        )
        return {
          threads,
          turns,
          providerStatus: provider?.status ?? "offline",
          ready: readiness.isReady(),
          lastSequence: pushBus.getLastSequence(),
        }
      },
      createThread: async (commandId, title) => {
        const id = createId("thread")
        const now = new Date().toISOString()
        const thread: OrchestrationThread = {
          id: id as OrchestrationThread["id"],
          title: title?.trim() || `Session ${new Date().toLocaleTimeString()}`,
          status: "idle",
          createdAt: now,
          currentTurnId: null,
        }

        database.transaction(() => {
          database.execute(
            `INSERT INTO orchestration_threads (id, title, status, current_turn_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [thread.id, thread.title, thread.status, thread.currentTurnId, thread.createdAt, now],
          )
          database.execute(
            `INSERT OR REPLACE INTO provider_runtime_sessions (thread_id, provider, status, last_error, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [thread.id, "stub", "idle", null, now],
          )
        })

        appendEvent("thread.created", { thread }, { threadId: thread.id, commandId })
        recordReceipt(commandId, "completed", { threadId: thread.id })
        await publishDomainEvent({ type: "thread.created", thread })
        await receiptBus.resolve(commandId, { threadId: thread.id })
        return { threadId: thread.id }
      },
      sendTurn: async (commandId, threadId, content) => {
        const thread = readThread(threadId)
        if (!thread) {
          throw new Error(`Thread not found: ${threadId}`)
        }

        const turnId = createId("turn")
        const now = new Date().toISOString()
        const turn: OrchestrationTurn = {
          id: turnId as OrchestrationTurn["id"],
          threadId: threadId as OrchestrationTurn["threadId"],
          input: content,
          output: "",
          status: "streaming",
          startedAt: now,
          completedAt: null,
        }

        await receiptBus.track(commandId)

        database.transaction(() => {
          database.execute(
            `INSERT INTO orchestration_turns (id, thread_id, input_text, output_text, status, started_at, completed_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [turn.id, turn.threadId, turn.input, turn.output, turn.status, turn.startedAt, turn.completedAt, now],
          )
          database.execute(
            `UPDATE orchestration_threads
             SET status = ?, current_turn_id = ?, updated_at = ?
             WHERE id = ?`,
            ["streaming", turn.id, now, threadId],
          )
          database.execute(
            `INSERT OR REPLACE INTO provider_runtime_sessions (thread_id, provider, status, last_error, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [threadId, "stub", "streaming", null, now],
          )
          recordReceipt(commandId, "pending", { threadId, turnId: turn.id })
        })

        activeTurns.set(turn.id, { interrupted: false })

        appendEvent("turn.started", { turn }, { threadId, turnId: turn.id, commandId })
        await publishDomainEvent({ type: "turn.started", turn })
        await publishRuntimeEvent({
          type: "provider.turnStarted",
          threadId: threadId as ProviderRuntimeEvent["threadId"],
          turnId: turn.id as ProviderRuntimeEvent["turnId"],
        })
        workQueue.push({ commandId, threadId, turnId: turn.id, content })
        void drainQueue()
        return { turnId: turn.id }
      },
      interruptTurn: async (commandId, threadId) => {
        const thread = readThread(threadId)
        if (!thread?.currentTurnId) {
          recordReceipt(commandId, "completed", { interrupted: false })
          await receiptBus.resolve(commandId, { interrupted: false })
          return { interrupted: false }
        }

        if (!activeTurns.has(thread.currentTurnId)) {
          const persistedTurn = readTurn(thread.currentTurnId)
          await completeTurn(
            commandId,
            threadId,
            thread.currentTurnId,
            persistedTurn?.output ?? "",
            true,
          )
          return { interrupted: true }
        }

        activeTurns.set(thread.currentTurnId, { interrupted: true })
        recordReceipt(commandId, "completed", { interrupted: true, turnId: thread.currentTurnId })
        await receiptBus.resolve(commandId, { interrupted: true, turnId: thread.currentTurnId })
        return { interrupted: true }
      },
    }
  }),
)
