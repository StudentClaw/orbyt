import { Context, Effect, Layer } from "effect"
import {
  PUSH_CHANNELS,
  type CreateThreadResult,
  type DesktopBootstrap,
  type InterruptTurnResult,
  type OrchestrationDomainEvent,
  type OrchestrationSnapshot,
  type OrchestrationThread,
  type OrchestrationTurn,
  type ProviderRuntimeEvent,
  type SendTurnResult,
  type ServerConfig,
} from "@student-claw/contracts"
import { createId, sleepMs } from "@student-claw/shared-runtime"
import { ConfigService } from "../config/ConfigService.js"
import type { AppConfig } from "../config/defaults.js"
import { Database, type DatabaseService } from "../db/Database.js"
import { ServerReadiness, type ServerReadinessService } from "../runtime/ServerReadiness.js"
import { PushBus, type PushBusService } from "../ws/PushBus.js"
import { RuntimeReceiptBus, type RuntimeReceiptBusService } from "./RuntimeReceiptBus.js"
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

type TurnWorkRef = {
  readonly commandId: string
  readonly threadId: string
  readonly turnId: string
}

type WorkItem = TurnWorkRef & {
  readonly content: string
}

type ActiveTurnState = {
  readonly interrupted: boolean
}

type OrchestrationRuntimeState = {
  readonly activeTurns: Map<string, ActiveTurnState>
  readonly workQueue: WorkItem[]
  drainingQueue: boolean
}

type OrchestrationRuntimeDeps = {
  readonly config: AppConfig
  readonly database: DatabaseService
  readonly pushBus: PushBusService
  readonly readiness: ServerReadinessService
  readonly receiptBus: RuntimeReceiptBusService
  readonly state: OrchestrationRuntimeState
}

/**
 * RPC-facing orchestration operations exposed to the local server router.
 */
export interface OrchestrationServiceShape {
  readonly getDesktopBootstrap: () => Promise<DesktopBootstrap>
  readonly getServerConfig: () => Promise<ServerConfig>
  readonly getSnapshot: () => Promise<OrchestrationSnapshot>
  readonly createThread: (commandId: string, title?: string) => Promise<CreateThreadResult>
  readonly sendTurn: (commandId: string, threadId: string, content: string) => Promise<SendTurnResult>
  readonly interruptTurn: (commandId: string, threadId: string) => Promise<InterruptTurnResult>
}

/**
 * Effect service tag for the orchestration runtime facade.
 */
export class OrchestrationService extends Context.Tag("OrchestrationService")<
  OrchestrationService,
  OrchestrationServiceShape
>() {}

function createRuntimeState(): OrchestrationRuntimeState {
  return {
    activeTurns: new Map(),
    workQueue: [],
    drainingQueue: false,
  }
}

function mapThreadRow(row: ThreadRow): OrchestrationThread {
  return {
    id: row.id as OrchestrationThread["id"],
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    currentTurnId: row.current_turn_id as OrchestrationThread["currentTurnId"],
  }
}

function mapTurnRow(row: TurnRow): OrchestrationTurn {
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

function appendEvent(
  deps: OrchestrationRuntimeDeps,
  eventType: string,
  payload: unknown,
  refs: { threadId?: string; turnId?: string; commandId?: string } = {},
): number {
  deps.database.execute(
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
  const row = deps.database.get<{ sequence: number }>(
    `SELECT sequence FROM orchestration_events ORDER BY sequence DESC LIMIT 1`,
  )
  return row?.sequence ?? 0
}

function recordReceipt(
  deps: OrchestrationRuntimeDeps,
  commandId: string,
  status: string,
  payload: unknown,
): void {
  deps.database.execute(
    `INSERT OR REPLACE INTO command_receipts (command_id, status, payload, created_at)
     VALUES (?, ?, ?, ?)`,
    [commandId, status, JSON.stringify(payload), new Date().toISOString()],
  )
}

function readThread(database: DatabaseService, threadId: string): OrchestrationThread | null {
  const row = database.get<ThreadRow>(
    `SELECT id, title, status, current_turn_id, created_at
     FROM orchestration_threads
     WHERE id = ?`,
    [threadId],
  )
  return row ? mapThreadRow(row) : null
}

function readTurn(database: DatabaseService, turnId: string): OrchestrationTurn | null {
  const row = database.get<TurnRow>(
    `SELECT id, thread_id, input_text, output_text, status, started_at, completed_at
     FROM orchestration_turns
     WHERE id = ?`,
    [turnId],
  )
  return row ? mapTurnRow(row) : null
}

async function publishDomainEvent(
  pushBus: PushBusService,
  event: OrchestrationDomainEvent,
): Promise<void> {
  await pushBus.publish(PUSH_CHANNELS.ORCHESTRATION_DOMAIN, event)
}

async function publishRuntimeEvent(
  pushBus: PushBusService,
  event: ProviderRuntimeEvent,
): Promise<void> {
  await pushBus.publish(PUSH_CHANNELS.PROVIDER_RUNTIME, event)
}

function reconcileStaleStreamingState(database: DatabaseService): void {
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

function persistTurnCompletion(
  database: DatabaseService,
  work: TurnWorkRef,
  output: string,
  interrupted: boolean,
): string {
  const completedAt = new Date().toISOString()
  const turnStatus = interrupted ? "interrupted" : "completed"

  database.transaction(() => {
    database.execute(
      `UPDATE orchestration_turns
       SET output_text = ?, status = ?, completed_at = ?, updated_at = ?
       WHERE id = ?`,
      [output, turnStatus, completedAt, completedAt, work.turnId],
    )
    database.execute(
      `UPDATE orchestration_threads
       SET status = ?, current_turn_id = NULL, updated_at = ?
       WHERE id = ?`,
      [turnStatus, completedAt, work.threadId],
    )
    database.execute(
      `INSERT OR REPLACE INTO provider_runtime_sessions (thread_id, provider, status, last_error, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [work.threadId, "stub", interrupted ? "interrupted" : "idle", null, completedAt],
    )
  })

  return turnStatus
}

async function publishInterruptedTurn(
  deps: OrchestrationRuntimeDeps,
  work: TurnWorkRef,
  turn: OrchestrationTurn,
): Promise<void> {
  appendEvent(deps, "turn.interrupted", { turn }, work)
  recordReceipt(deps, work.commandId, "interrupted", { turnId: work.turnId, threadId: work.threadId })
  await publishRuntimeEvent(deps.pushBus, {
    type: "provider.turnInterrupted",
    threadId: work.threadId as ProviderRuntimeEvent["threadId"],
    turnId: work.turnId as ProviderRuntimeEvent["turnId"],
  })
  await publishDomainEvent(deps.pushBus, { type: "turn.interrupted", turn })
}

async function publishCompletedTurn(
  deps: OrchestrationRuntimeDeps,
  work: TurnWorkRef,
  turn: OrchestrationTurn,
  output: string,
): Promise<void> {
  appendEvent(deps, "turn.completed", { turn }, work)
  recordReceipt(deps, work.commandId, "completed", { turnId: work.turnId, threadId: work.threadId })
  await publishRuntimeEvent(deps.pushBus, {
    type: "provider.turnCompleted",
    threadId: work.threadId as ProviderRuntimeEvent["threadId"],
    turnId: work.turnId as ProviderRuntimeEvent["turnId"],
    output,
  })
  await publishDomainEvent(deps.pushBus, { type: "turn.completed", turn })
}

async function completeTurn(
  deps: OrchestrationRuntimeDeps,
  work: TurnWorkRef,
  output: string,
  interrupted: boolean,
): Promise<void> {
  const turnStatus = persistTurnCompletion(deps.database, work, output, interrupted)
  const turn = readTurn(deps.database, work.turnId)
  if (turn) {
    if (interrupted) {
      await publishInterruptedTurn(deps, work, turn)
    } else {
      await publishCompletedTurn(deps, work, turn, output)
    }
  }

  await deps.receiptBus.resolve(work.commandId, {
    turnId: work.turnId,
    threadId: work.threadId,
    status: turnStatus,
  })
  deps.state.activeTurns.delete(work.turnId)
}

function persistStreamingToken(
  database: DatabaseService,
  turnId: string,
  output: string,
): void {
  database.execute(
    `UPDATE orchestration_turns
     SET output_text = ?, updated_at = ?
     WHERE id = ?`,
    [output, new Date().toISOString(), turnId],
  )
}

async function publishStreamingUpdate(
  deps: OrchestrationRuntimeDeps,
  work: WorkItem,
  token: string,
  index: number,
  output: string,
): Promise<void> {
  await publishRuntimeEvent(deps.pushBus, {
    type: "provider.token",
    threadId: work.threadId as ProviderRuntimeEvent["threadId"],
    turnId: work.turnId as ProviderRuntimeEvent["turnId"],
    token,
    index,
  })

  const turn = readTurn(deps.database, work.turnId)
  if (!turn) {
    return
  }

  appendEvent(deps, "turn.updated", { turn }, work)
  await publishDomainEvent(deps.pushBus, { type: "turn.updated", turn })
  void output
}

function interruptWorkWithError(
  database: DatabaseService,
  work: WorkItem,
  error: unknown,
): void {
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
}

async function processWork(
  deps: OrchestrationRuntimeDeps,
  work: WorkItem,
): Promise<void> {
  try {
    let output = ""

    for (const [index, token] of tokenizeStubResponse(work.content).entries()) {
      if (deps.state.activeTurns.get(work.turnId)?.interrupted) {
        await completeTurn(deps, work, output, true)
        return
      }

      await sleepMs(45)
      output += token
      persistStreamingToken(deps.database, work.turnId, output)
      await publishStreamingUpdate(deps, work, token, index, output)
    }

    await completeTurn(deps, work, output, false)
  } catch (error) {
    interruptWorkWithError(deps.database, work, error)
    deps.state.activeTurns.delete(work.turnId)
  }
}

async function drainQueue(deps: OrchestrationRuntimeDeps): Promise<void> {
  if (deps.state.drainingQueue) {
    return
  }

  deps.state.drainingQueue = true
  try {
    while (deps.state.workQueue.length > 0) {
      const next = deps.state.workQueue.shift()
      if (next) {
        await processWork(deps, next)
      }
    }
  } finally {
    deps.state.drainingQueue = false
    if (deps.state.workQueue.length > 0) {
      void drainQueue(deps)
    }
  }
}

function buildDesktopBootstrap(config: AppConfig): DesktopBootstrap {
  return {
    wsUrl: `ws://${config.wsHost}:${config.port}`,
    wsAuthToken: config.wsAuthToken,
    appVersion: "0.1.0",
    platform: process.platform,
  }
}

function buildServerConfig(): ServerConfig {
  return {
    appVersion: "0.1.0",
    platform: process.platform,
    protocolVersion: "rpc-v1",
    capabilities: {
      orchestration: true,
      providerRuntime: true,
      desktopBootstrap: true,
    },
  }
}

async function getSnapshot(deps: OrchestrationRuntimeDeps): Promise<OrchestrationSnapshot> {
  const threads = deps.database.query<ThreadRow>(
    `SELECT id, title, status, current_turn_id, created_at
     FROM orchestration_threads
     ORDER BY created_at ASC`,
  ).map(mapThreadRow)

  const turns = deps.database.query<TurnRow>(
    `SELECT id, thread_id, input_text, output_text, status, started_at, completed_at
     FROM orchestration_turns
     ORDER BY started_at ASC`,
  ).map(mapTurnRow)

  const provider = deps.database.get<{ status: OrchestrationSnapshot["providerStatus"] }>(
    `SELECT status FROM provider_runtime_sessions ORDER BY updated_at DESC LIMIT 1`,
  )

  return {
    threads,
    turns,
    providerStatus: provider?.status ?? "offline",
    ready: deps.readiness.isReady(),
    lastSequence: deps.pushBus.getLastSequence(),
  }
}

function buildThread(title?: string): OrchestrationThread {
  const now = new Date().toISOString()
  return {
    id: createId("thread") as OrchestrationThread["id"],
    title: title?.trim() || `Session ${new Date().toLocaleTimeString()}`,
    status: "idle",
    createdAt: now,
    currentTurnId: null,
  }
}

async function createThread(
  deps: OrchestrationRuntimeDeps,
  commandId: string,
  title?: string,
): Promise<CreateThreadResult> {
  const thread = buildThread(title)
  const now = new Date().toISOString()

  deps.database.transaction(() => {
    deps.database.execute(
      `INSERT INTO orchestration_threads (id, title, status, current_turn_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [thread.id, thread.title, thread.status, thread.currentTurnId, thread.createdAt, now],
    )
    deps.database.execute(
      `INSERT OR REPLACE INTO provider_runtime_sessions (thread_id, provider, status, last_error, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [thread.id, "stub", "idle", null, now],
    )
  })

  appendEvent(deps, "thread.created", { thread }, { threadId: thread.id, commandId })
  recordReceipt(deps, commandId, "completed", { threadId: thread.id })
  await publishDomainEvent(deps.pushBus, { type: "thread.created", thread })
  await deps.receiptBus.resolve(commandId, { threadId: thread.id })
  return { threadId: thread.id }
}

function buildStreamingTurn(threadId: string, content: string): OrchestrationTurn {
  const now = new Date().toISOString()
  return {
    id: createId("turn") as OrchestrationTurn["id"],
    threadId: threadId as OrchestrationTurn["threadId"],
    input: content,
    output: "",
    status: "streaming",
    startedAt: now,
    completedAt: null,
  }
}

async function sendTurn(
  deps: OrchestrationRuntimeDeps,
  commandId: string,
  threadId: string,
  content: string,
): Promise<SendTurnResult> {
  if (!readThread(deps.database, threadId)) {
    throw new Error(`Thread not found: ${threadId}`)
  }

  const turn = buildStreamingTurn(threadId, content)
  const now = new Date().toISOString()
  await deps.receiptBus.track(commandId)

  deps.database.transaction(() => {
    deps.database.execute(
      `INSERT INTO orchestration_turns (id, thread_id, input_text, output_text, status, started_at, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [turn.id, turn.threadId, turn.input, turn.output, turn.status, turn.startedAt, turn.completedAt, now],
    )
    deps.database.execute(
      `UPDATE orchestration_threads
       SET status = ?, current_turn_id = ?, updated_at = ?
       WHERE id = ?`,
      ["streaming", turn.id, now, threadId],
    )
    deps.database.execute(
      `INSERT OR REPLACE INTO provider_runtime_sessions (thread_id, provider, status, last_error, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [threadId, "stub", "streaming", null, now],
    )
    recordReceipt(deps, commandId, "pending", { threadId, turnId: turn.id })
  })

  deps.state.activeTurns.set(turn.id, { interrupted: false })
  appendEvent(deps, "turn.started", { turn }, { threadId, turnId: turn.id, commandId })
  await publishDomainEvent(deps.pushBus, { type: "turn.started", turn })
  await publishRuntimeEvent(deps.pushBus, {
    type: "provider.turnStarted",
    threadId: threadId as ProviderRuntimeEvent["threadId"],
    turnId: turn.id as ProviderRuntimeEvent["turnId"],
  })
  deps.state.workQueue.push({ commandId, threadId, turnId: turn.id, content })
  void drainQueue(deps)
  return { turnId: turn.id }
}

async function interruptTurn(
  deps: OrchestrationRuntimeDeps,
  commandId: string,
  threadId: string,
): Promise<InterruptTurnResult> {
  const thread = readThread(deps.database, threadId)
  if (!thread?.currentTurnId) {
    recordReceipt(deps, commandId, "completed", { interrupted: false })
    await deps.receiptBus.resolve(commandId, { interrupted: false })
    return { interrupted: false }
  }

  const turnRef = { commandId, threadId, turnId: thread.currentTurnId }
  if (!deps.state.activeTurns.has(thread.currentTurnId)) {
    const persistedTurn = readTurn(deps.database, thread.currentTurnId)
    await completeTurn(deps, turnRef, persistedTurn?.output ?? "", true)
    return { interrupted: true }
  }

  deps.state.activeTurns.set(thread.currentTurnId, { interrupted: true })
  recordReceipt(deps, commandId, "completed", { interrupted: true, turnId: thread.currentTurnId })
  await deps.receiptBus.resolve(commandId, { interrupted: true, turnId: thread.currentTurnId })
  return { interrupted: true }
}

function createOrchestrationService(deps: OrchestrationRuntimeDeps): OrchestrationServiceShape {
  reconcileStaleStreamingState(deps.database)

  return {
    getDesktopBootstrap: async () => buildDesktopBootstrap(deps.config),
    getServerConfig: async () => buildServerConfig(),
    getSnapshot: () => getSnapshot(deps),
    createThread: (commandId, title) => createThread(deps, commandId, title),
    sendTurn: (commandId, threadId, content) => sendTurn(deps, commandId, threadId, content),
    interruptTurn: (commandId, threadId) => interruptTurn(deps, commandId, threadId),
  }
}

/**
 * Builds the live orchestration service with persistence, push fanout, and receipt tracking.
 */
export const OrchestrationServiceLive = Layer.scoped(
  OrchestrationService,
  Effect.gen(function* () {
    const config = yield* ConfigService
    const database = yield* Database
    const pushBus = yield* PushBus
    const readiness = yield* ServerReadiness
    const receiptBus = yield* RuntimeReceiptBus

    return createOrchestrationService({
      config,
      database,
      pushBus,
      readiness,
      receiptBus,
      state: createRuntimeState(),
    })
  }),
)
