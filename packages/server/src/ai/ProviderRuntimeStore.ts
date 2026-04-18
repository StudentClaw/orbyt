import { Context, Effect, Layer } from "effect"
import {
  PUSH_CHANNELS,
  type ProviderAuthState,
  type ProviderRuntimeState,
  type ProviderRuntimeStatus,
} from "@student-claw/contracts"
import { Database } from "../db/Database.js"
import { PushBus, type PushBusService } from "../ws/PushBus.js"

type ProviderRuntimeRow = {
  provider: string
  status: ProviderRuntimeStatus
  auth_state: ProviderAuthState
  last_error_code: string | null
  last_error_message: string | null
  queued_turn_count: number
  runtime_payload: string | null
  last_updated_at: string
}

type ProviderRuntimeSessionRow = {
  thread_id: string
  provider: string
  status: ProviderRuntimeStatus
  last_error: string | null
  updated_at: string
  provider_thread_id: string | null
  auth_state: ProviderAuthState
  runtime_payload: string | null
  cwd: string | null
}

type QueuedProviderTurnRow = {
  turn_id: string
  thread_id: string
  content: string
  created_at: string
  updated_at: string
}

export type ThreadProviderSession = {
  readonly threadId: string
  readonly provider: "codex"
  readonly status: ProviderRuntimeStatus
  readonly lastError: string | null
  readonly updatedAt: string
  readonly providerThreadId: string | null
  readonly authState: ProviderAuthState
  readonly runtimePayload: unknown
  readonly cwd: string | null
}

export type QueuedProviderTurn = {
  readonly turnId: string
  readonly threadId: string
  readonly content: string
  readonly createdAt: string
  readonly updatedAt: string
}

type RuntimeStatePatch = {
  readonly adapter?: ProviderRuntimeState["adapter"]
  readonly status?: ProviderRuntimeStatus
  readonly authState?: ProviderAuthState
  readonly lastError?: ProviderRuntimeState["lastError"]
  readonly queuedTurnCount?: number
  readonly runtimePayload?: unknown
}

type ThreadSessionPatch = {
  readonly status?: ProviderRuntimeStatus
  readonly lastError?: string | null
  readonly providerThreadId?: string | null
  readonly authState?: ProviderAuthState
  readonly runtimePayload?: unknown
  readonly cwd?: string | null
}

export interface ProviderRuntimeStoreService {
  readonly getState: () => Promise<ProviderRuntimeState>
  readonly updateState: (patch: RuntimeStatePatch) => Promise<ProviderRuntimeState>
  readonly getThreadSession: (threadId: string) => Promise<ThreadProviderSession | null>
  readonly upsertThreadSession: (threadId: string, patch: ThreadSessionPatch) => Promise<void>
  readonly enqueueTurn: (turnId: string, threadId: string, content: string) => Promise<void>
  readonly dequeueTurn: (turnId: string) => Promise<void>
  readonly listQueuedTurns: () => Promise<ReadonlyArray<QueuedProviderTurn>>
  readonly refreshQueuedCount: () => Promise<number>
  readonly drain: () => Promise<void>
}

export class ProviderRuntimeStore extends Context.Tag("ProviderRuntimeStore")<
  ProviderRuntimeStore,
  ProviderRuntimeStoreService
>() {}

const DEFAULT_STATE: ProviderRuntimeState = {
  adapter: "codex",
  status: "offline",
  authState: "unknown",
  lastError: null,
  queuedTurnCount: 0,
  lastUpdatedAt: new Date(0).toISOString(),
}

function parseJson(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function toRuntimeState(row: ProviderRuntimeRow | null): ProviderRuntimeState {
  if (!row) {
    return DEFAULT_STATE
  }

  const payload = parseJson(row.runtime_payload) as Record<string, unknown> | null
  const adapter = payload?.adapter === "stub" ? "stub" : "codex"

  return {
    adapter,
    status: row.status,
    authState: row.auth_state,
    lastError:
      row.last_error_code && row.last_error_message
        ? {
            code: row.last_error_code,
            message: row.last_error_message,
          }
        : null,
    queuedTurnCount: row.queued_turn_count,
    lastUpdatedAt: row.last_updated_at,
  }
}

function toThreadSession(row: ProviderRuntimeSessionRow): ThreadProviderSession {
  return {
    threadId: row.thread_id,
    provider: "codex",
    status: row.status,
    lastError: row.last_error,
    updatedAt: row.updated_at,
    providerThreadId: row.provider_thread_id,
    authState: row.auth_state,
    runtimePayload: parseJson(row.runtime_payload),
    cwd: row.cwd,
  }
}

async function publishState(pushBus: PushBusService, state: ProviderRuntimeState): Promise<void> {
  await pushBus.publish(PUSH_CHANNELS.PROVIDER_RUNTIME, {
    type: "provider.stateChanged",
    state,
  })
}

export const ProviderRuntimeStoreLive = Layer.effect(
  ProviderRuntimeStore,
  Effect.gen(function* () {
    const database = yield* Database
    const pushBus = yield* PushBus
    let writeQueue = Promise.resolve()

    const isBusyError = (error: unknown): boolean =>
      error instanceof Error &&
      "code" in error &&
      (error as { code?: unknown }).code === "SQLITE_BUSY"

    const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        setTimeout(resolve, ms)
      })

    const runWriteWithRetry = async <T>(write: () => T, attempt = 0): Promise<T> => {
      try {
        return write()
      } catch (error) {
        if (!isBusyError(error) || attempt >= 4) {
          throw error
        }
        await sleep(25 * (attempt + 1))
        return runWriteWithRetry(write, attempt + 1)
      }
    }

    const serializeWrite = async <T>(write: () => Promise<T>): Promise<T> => {
      const next = writeQueue.then(write, write)
      writeQueue = next.then(
        () => undefined,
        () => undefined,
      )
      return next
    }

    const ensureRuntimeState = (): ProviderRuntimeState => {
      const existing = database.get<ProviderRuntimeRow>(
        `SELECT provider, status, auth_state, last_error_code, last_error_message,
                queued_turn_count, runtime_payload, last_updated_at
         FROM provider_runtime_state
         WHERE provider = ?`,
        ["codex"],
      )

      if (existing) {
        return toRuntimeState(existing)
      }

      const now = new Date().toISOString()
      try {
        database.execute(
          `INSERT INTO provider_runtime_state (
             provider, status, auth_state, last_error_code, last_error_message,
             queued_turn_count, runtime_payload, last_updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ["codex", "offline", "unknown", null, null, 0, JSON.stringify({ adapter: "codex" }), now],
        )
      } catch {
        const raced = database.get<ProviderRuntimeRow>(
          `SELECT provider, status, auth_state, last_error_code, last_error_message,
                  queued_turn_count, runtime_payload, last_updated_at
           FROM provider_runtime_state
           WHERE provider = ?`,
          ["codex"],
        )
        if (raced) {
          return toRuntimeState(raced)
        }
        throw new Error("Failed to initialize provider runtime state row.")
      }

      return {
        ...DEFAULT_STATE,
        lastUpdatedAt: now,
      }
    }

    ensureRuntimeState()

    const getQueuedCount = (): number =>
      database.get<{ count: number }>(`SELECT COUNT(*) as count FROM queued_provider_turns`)?.count ?? 0

    const updateStateUnsafe = async (patch: RuntimeStatePatch): Promise<ProviderRuntimeState> => {
      const current = ensureRuntimeState()
      const next: ProviderRuntimeState = {
        adapter: patch.adapter ?? current.adapter,
        status: patch.status ?? current.status,
        authState: patch.authState ?? current.authState,
        lastError: patch.lastError === undefined ? current.lastError : patch.lastError,
        queuedTurnCount: patch.queuedTurnCount ?? current.queuedTurnCount,
        lastUpdatedAt: new Date().toISOString(),
      }

      await runWriteWithRetry(() => {
        database.execute(
          `INSERT OR REPLACE INTO provider_runtime_state (
             provider, status, auth_state, last_error_code, last_error_message,
             queued_turn_count, runtime_payload, last_updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            "codex",
            next.status,
            next.authState,
            next.lastError?.code ?? null,
            next.lastError?.message ?? null,
            next.queuedTurnCount,
            JSON.stringify({
              adapter: next.adapter,
              runtimePayload: patch.runtimePayload ?? null,
            }),
            next.lastUpdatedAt,
          ],
        )
      })

      await publishState(pushBus, next)
      return next
    }

    const updateState = async (patch: RuntimeStatePatch): Promise<ProviderRuntimeState> =>
      serializeWrite(() => updateStateUnsafe(patch))

    return {
      getState: async () => {
        const row = database.get<ProviderRuntimeRow>(
          `SELECT provider, status, auth_state, last_error_code, last_error_message,
                  queued_turn_count, runtime_payload, last_updated_at
           FROM provider_runtime_state
           WHERE provider = ?`,
          ["codex"],
        )
        return toRuntimeState(row)
      },
      updateState,
      getThreadSession: async (threadId) => {
        const row = database.get<ProviderRuntimeSessionRow>(
          `SELECT thread_id, provider, status, last_error, updated_at,
                  provider_thread_id, auth_state, runtime_payload, cwd
           FROM provider_runtime_sessions
           WHERE thread_id = ?`,
          [threadId],
        )
        return row ? toThreadSession(row) : null
      },
      upsertThreadSession: async (threadId, patch) => serializeWrite(async () => {
        const current = database.get<ProviderRuntimeSessionRow>(
          `SELECT thread_id, provider, status, last_error, updated_at,
                  provider_thread_id, auth_state, runtime_payload, cwd
           FROM provider_runtime_sessions
           WHERE thread_id = ?`,
          [threadId],
        )
        const state = ensureRuntimeState()
        const nextUpdatedAt = new Date().toISOString()

        await runWriteWithRetry(() => {
          database.execute(
            `INSERT OR REPLACE INTO provider_runtime_sessions (
               thread_id, provider, status, last_error, updated_at,
               provider_thread_id, auth_state, runtime_payload, cwd
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              threadId,
              "codex",
              patch.status ?? current?.status ?? state.status,
              patch.lastError === undefined ? current?.last_error ?? null : patch.lastError,
              nextUpdatedAt,
              patch.providerThreadId === undefined
                ? current?.provider_thread_id ?? null
                : patch.providerThreadId,
              patch.authState ?? current?.auth_state ?? state.authState,
              JSON.stringify(
                patch.runtimePayload === undefined
                  ? parseJson(current?.runtime_payload ?? null) ?? null
                  : patch.runtimePayload,
              ),
              patch.cwd === undefined ? current?.cwd ?? null : patch.cwd,
            ],
          )
        })
      }),
      enqueueTurn: async (turnId, threadId, content) => serializeWrite(async () => {
        const now = new Date().toISOString()
        try {
          await runWriteWithRetry(() => {
            database.execute(
              `INSERT OR REPLACE INTO queued_provider_turns (
                 turn_id, thread_id, content, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?)`,
              [turnId, threadId, content, now, now],
            )
          })
        } catch (err) {
          // Thread or turn was deleted between sendTurn and this deferred write — silently drop.
          if (
            err instanceof Error &&
            err.message.includes("FOREIGN KEY constraint failed")
          ) {
            return
          }
          throw err
        }
        await updateStateUnsafe({ queuedTurnCount: getQueuedCount() })
      }),
      dequeueTurn: async (turnId) => serializeWrite(async () => {
        await runWriteWithRetry(() => {
          database.execute(`DELETE FROM queued_provider_turns WHERE turn_id = ?`, [turnId])
        })
        await updateStateUnsafe({ queuedTurnCount: getQueuedCount() })
      }),
      listQueuedTurns: async () =>
        database.query<QueuedProviderTurnRow>(
          `SELECT turn_id, thread_id, content, created_at, updated_at
           FROM queued_provider_turns
           ORDER BY created_at ASC`,
        ).map((row) => ({
          turnId: row.turn_id,
          threadId: row.thread_id,
          content: row.content,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      refreshQueuedCount: async () => serializeWrite(async () => {
        const queuedTurnCount = getQueuedCount()
        await updateStateUnsafe({ queuedTurnCount })
        return queuedTurnCount
      }),
      drain: () => writeQueue,
    }
  }),
)
