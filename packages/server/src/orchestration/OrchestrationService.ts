import { existsSync, statSync } from "node:fs"
import path from "node:path"
import { Context, Effect, Layer } from "effect"
import {
  PUSH_CHANNELS,
  type CreateThreadResult,
  type CreateWorkspaceResult,
  type DeleteWorkspaceResult,
  type DesktopBootstrap,
  type InterruptTurnResult,
  type OrchestrationDomainEvent,
  type OrchestrationSnapshot,
  type OrchestrationThread,
  type OrchestrationTurn,
  type OrchestrationWorkspace,
  type ProviderRuntimeEvent,
  type RelinkWorkspaceResult,
  type SendTurnResult,
  type ServerConfig,
  type WorkspaceId,
} from "@student-claw/contracts"
import { createId, sleepMs } from "@student-claw/shared-runtime"
import { ConfigService } from "../config/ConfigService.js"
import type { AppConfig } from "../config/defaults.js"
import { Database, type DatabaseService } from "../db/Database.js"
import { ServerReadiness, type ServerReadinessService } from "../runtime/ServerReadiness.js"
import { PushBus, type PushBusService } from "../ws/PushBus.js"
import { RuntimeReceiptBus, type RuntimeReceiptBusService } from "./RuntimeReceiptBus.js"
import { tokenizeStubResponse } from "./StubProvider.js"

const LEGACY_WORKSPACE_ID = "workspace_legacy" as WorkspaceId

type WorkspaceRow = {
  id: string
  kind: OrchestrationWorkspace["kind"]
  name: string
  root_path: string | null
  availability: Extract<OrchestrationWorkspace, { kind: "filesystem" }>["availability"] | null
  created_at: string
  updated_at: string
}

type ThreadRow = {
  id: string
  workspace_id: string
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

type WorkspaceThreadRow = {
  id: string
  current_turn_id: string | null
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
  readonly createWorkspace: (commandId: string, rootPath: string) => Promise<CreateWorkspaceResult>
  readonly relinkWorkspace: (commandId: string, workspaceId: string, rootPath: string) => Promise<RelinkWorkspaceResult>
  readonly deleteWorkspace: (commandId: string, workspaceId: string) => Promise<DeleteWorkspaceResult>
  readonly createThread: (commandId: string, workspaceId: string, title?: string) => Promise<CreateThreadResult>
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

function normalizeRootPath(rawRootPath: string): string {
  const trimmed = rawRootPath.trim()
  if (trimmed.length === 0) {
    throw new Error("Workspace root path is required")
  }

  const normalized = path.normalize(path.resolve(trimmed))
  return process.platform === "win32" ? normalized.toLowerCase() : normalized
}

function isDirectoryPath(rootPath: string): boolean {
  if (!existsSync(rootPath)) {
    return false
  }

  try {
    return statSync(rootPath).isDirectory()
  } catch {
    return false
  }
}

function deriveWorkspaceName(rootPath: string): string {
  const name = path.basename(rootPath)
  return name.length > 0 ? name : rootPath
}

function resolveWorkspaceAvailability(rootPath: string): Extract<
  OrchestrationWorkspace,
  { kind: "filesystem" }
>["availability"] {
  return isDirectoryPath(rootPath) ? "ready" : "missing"
}

function mapWorkspaceRow(row: WorkspaceRow): OrchestrationWorkspace {
  if (row.kind === "filesystem") {
    return {
      id: row.id as WorkspaceId,
      kind: "filesystem",
      name: row.name,
      rootPath: row.root_path ?? "",
      availability: row.availability ?? "missing",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  return {
    id: row.id as WorkspaceId,
    kind: "legacy",
    name: row.name,
    rootPath: null,
    availability: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapThreadRow(row: ThreadRow): OrchestrationThread {
  return {
    id: row.id as OrchestrationThread["id"],
    workspaceId: row.workspace_id as WorkspaceId,
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

function readWorkspaceRow(database: DatabaseService, workspaceId: string): WorkspaceRow | null {
  return database.get<WorkspaceRow>(
    `SELECT id, kind, name, root_path, availability, created_at, updated_at
     FROM chat_workspaces
     WHERE id = ?`,
    [workspaceId],
  )
}

function readWorkspace(database: DatabaseService, workspaceId: string): OrchestrationWorkspace | null {
  const row = readWorkspaceRow(database, workspaceId)
  return row ? mapWorkspaceRow(row) : null
}

function readFilesystemWorkspaceByRootPath(
  database: DatabaseService,
  rootPath: string,
): OrchestrationWorkspace | null {
  const row = database.get<WorkspaceRow>(
    `SELECT id, kind, name, root_path, availability, created_at, updated_at
     FROM chat_workspaces
     WHERE kind = 'filesystem' AND root_path = ?`,
    [rootPath],
  )
  return row ? mapWorkspaceRow(row) : null
}

function readThread(database: DatabaseService, threadId: string): OrchestrationThread | null {
  const row = database.get<ThreadRow>(
    `SELECT id, workspace_id, title, status, current_turn_id, created_at
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

function readWorkspaceThreadRows(database: DatabaseService, workspaceId: string): readonly WorkspaceThreadRow[] {
  return database.query<WorkspaceThreadRow>(
    `SELECT id, current_turn_id
     FROM orchestration_threads
     WHERE workspace_id = ?`,
    [workspaceId],
  )
}

function updateWorkspaceAvailability(
  database: DatabaseService,
  workspaceId: string,
  availability: Extract<OrchestrationWorkspace, { kind: "filesystem" }>["availability"],
): void {
  database.execute(
    `UPDATE chat_workspaces
     SET availability = ?, updated_at = ?
     WHERE id = ?`,
    [availability, new Date().toISOString(), workspaceId],
  )
}

function refreshFilesystemWorkspaceAvailability(database: DatabaseService): void {
  const rows = database.query<WorkspaceRow>(
    `SELECT id, kind, name, root_path, availability, created_at, updated_at
     FROM chat_workspaces
     WHERE kind = 'filesystem'`,
  )

  if (rows.length === 0) {
    return
  }

  database.transaction(() => {
    for (const row of rows) {
      if (!row.root_path) {
        continue
      }

      const nextAvailability = resolveWorkspaceAvailability(row.root_path)
      if (row.availability !== nextAvailability) {
        updateWorkspaceAvailability(database, row.id, nextAvailability)
      }
    }
  })
}

function assertWorkspaceAcceptsChat(workspace: OrchestrationWorkspace): void {
  if (workspace.kind === "filesystem" && workspace.availability !== "ready") {
    throw new Error(`Workspace is unavailable: ${workspace.name}`)
  }
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
  refreshFilesystemWorkspaceAvailability(deps.database)

  const workspaces = deps.database.query<WorkspaceRow>(
    `SELECT id, kind, name, root_path, availability, created_at, updated_at
     FROM chat_workspaces
     ORDER BY created_at ASC`,
  ).map(mapWorkspaceRow)

  const threads = deps.database.query<ThreadRow>(
    `SELECT id, workspace_id, title, status, current_turn_id, created_at
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
    workspaces,
    threads,
    turns,
    providerStatus: provider?.status ?? "offline",
    ready: deps.readiness.isReady(),
    lastSequence: deps.pushBus.getLastSequence(),
  }
}

function buildThread(workspaceId: string, title?: string): OrchestrationThread {
  const now = new Date().toISOString()
  return {
    id: createId("thread") as OrchestrationThread["id"],
    workspaceId: workspaceId as WorkspaceId,
    title: title?.trim() || `Session ${new Date().toLocaleTimeString()}`,
    status: "idle",
    createdAt: now,
    currentTurnId: null,
  }
}

function buildFilesystemWorkspace(rootPath: string): Extract<OrchestrationWorkspace, { kind: "filesystem" }> {
  const now = new Date().toISOString()
  return {
    id: createId("workspace") as WorkspaceId,
    kind: "filesystem",
    name: deriveWorkspaceName(rootPath),
    rootPath,
    availability: resolveWorkspaceAvailability(rootPath),
    createdAt: now,
    updatedAt: now,
  }
}

async function createWorkspace(
  deps: OrchestrationRuntimeDeps,
  commandId: string,
  rawRootPath: string,
): Promise<CreateWorkspaceResult> {
  const rootPath = normalizeRootPath(rawRootPath)
  if (!isDirectoryPath(rootPath)) {
    throw new Error(`Workspace folder not found: ${rootPath}`)
  }

  const existing = readFilesystemWorkspaceByRootPath(deps.database, rootPath)
  if (existing) {
    if (existing.kind === "filesystem" && existing.availability !== "ready") {
      updateWorkspaceAvailability(deps.database, existing.id, "ready")
      const refreshed = readWorkspace(deps.database, existing.id)
      if (refreshed) {
        appendEvent(deps, "workspace.updated", { workspace: refreshed }, { commandId })
        await publishDomainEvent(deps.pushBus, { type: "workspace.updated", workspace: refreshed })
      }
    }
    recordReceipt(deps, commandId, "completed", { workspaceId: existing.id })
    await deps.receiptBus.resolve(commandId, { workspaceId: existing.id })
    return { workspaceId: existing.id }
  }

  const workspace = buildFilesystemWorkspace(rootPath)
  deps.database.execute(
    `INSERT INTO chat_workspaces (id, kind, name, root_path, availability, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      workspace.id,
      workspace.kind,
      workspace.name,
      workspace.rootPath,
      workspace.availability,
      workspace.createdAt,
      workspace.updatedAt,
    ],
  )

  appendEvent(deps, "workspace.created", { workspace }, { commandId })
  recordReceipt(deps, commandId, "completed", { workspaceId: workspace.id })
  await publishDomainEvent(deps.pushBus, { type: "workspace.created", workspace })
  await deps.receiptBus.resolve(commandId, { workspaceId: workspace.id })
  return { workspaceId: workspace.id }
}

async function relinkWorkspace(
  deps: OrchestrationRuntimeDeps,
  commandId: string,
  workspaceId: string,
  rawRootPath: string,
): Promise<RelinkWorkspaceResult> {
  const workspace = readWorkspace(deps.database, workspaceId)
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`)
  }
  if (workspace.kind !== "filesystem") {
    throw new Error("Only filesystem workspaces can be relinked")
  }

  const rootPath = normalizeRootPath(rawRootPath)
  if (!isDirectoryPath(rootPath)) {
    throw new Error(`Workspace folder not found: ${rootPath}`)
  }

  const duplicate = readFilesystemWorkspaceByRootPath(deps.database, rootPath)
  if (duplicate && duplicate.id !== workspace.id) {
    throw new Error(`Workspace already exists for folder: ${rootPath}`)
  }

  const now = new Date().toISOString()
  deps.database.execute(
    `UPDATE chat_workspaces
     SET name = ?, root_path = ?, availability = ?, updated_at = ?
     WHERE id = ?`,
    [deriveWorkspaceName(rootPath), rootPath, "ready", now, workspaceId],
  )

  const updatedWorkspace = readWorkspace(deps.database, workspaceId)
  if (!updatedWorkspace) {
    throw new Error(`Workspace not found after relink: ${workspaceId}`)
  }

  appendEvent(deps, "workspace.updated", { workspace: updatedWorkspace }, { commandId })
  recordReceipt(deps, commandId, "completed", { workspaceId: updatedWorkspace.id })
  await publishDomainEvent(deps.pushBus, { type: "workspace.updated", workspace: updatedWorkspace })
  await deps.receiptBus.resolve(commandId, { workspaceId: updatedWorkspace.id })
  return { workspaceId: updatedWorkspace.id }
}

function buildDeletePlaceholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ")
}

async function deleteWorkspace(
  deps: OrchestrationRuntimeDeps,
  commandId: string,
  workspaceId: string,
): Promise<DeleteWorkspaceResult> {
  const workspace = readWorkspace(deps.database, workspaceId)
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`)
  }

  const threadRows = readWorkspaceThreadRows(deps.database, workspaceId)
  const deletedThreadIds = threadRows.map((row) => row.id as OrchestrationThread["id"])
  const deletedThreadIdSet = new Set(threadRows.map((row) => row.id))
  const activeTurnIds = threadRows.flatMap((row) => row.current_turn_id ? [row.current_turn_id] : [])

  for (const turnId of activeTurnIds) {
    deps.state.activeTurns.delete(turnId)
  }

  const remainingQueue = deps.state.workQueue.filter((item) => !deletedThreadIdSet.has(item.threadId))
  deps.state.workQueue.splice(0, deps.state.workQueue.length, ...remainingQueue)

  deps.database.transaction(() => {
    if (deletedThreadIds.length > 0) {
      const placeholders = buildDeletePlaceholders(deletedThreadIds.length)
      deps.database.execute(
        `DELETE FROM orchestration_turns WHERE thread_id IN (${placeholders})`,
        deletedThreadIds,
      )
      deps.database.execute(
        `DELETE FROM provider_runtime_sessions WHERE thread_id IN (${placeholders})`,
        deletedThreadIds,
      )
      deps.database.execute(
        `DELETE FROM orchestration_threads WHERE id IN (${placeholders})`,
        deletedThreadIds,
      )
    }

    deps.database.execute(`DELETE FROM chat_workspaces WHERE id = ?`, [workspaceId])
  })

  appendEvent(
    deps,
    "workspace.deleted",
    { workspaceId, deletedThreadIds },
    { commandId },
  )
  recordReceipt(deps, commandId, "completed", {
    deleted: true,
    workspaceId,
    deletedThreadIds,
  })
  await publishDomainEvent(deps.pushBus, {
    type: "workspace.deleted",
    workspaceId: workspace.id,
    deletedThreadIds,
  })
  await deps.receiptBus.resolve(commandId, { deleted: true })
  return { deleted: true }
}

async function createThread(
  deps: OrchestrationRuntimeDeps,
  commandId: string,
  workspaceId: string,
  title?: string,
): Promise<CreateThreadResult> {
  const workspace = readWorkspace(deps.database, workspaceId)
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`)
  }
  assertWorkspaceAcceptsChat(workspace)

  const thread = buildThread(workspaceId, title)
  const now = new Date().toISOString()

  deps.database.transaction(() => {
    deps.database.execute(
      `INSERT INTO orchestration_threads (id, workspace_id, title, status, current_turn_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        thread.id,
        thread.workspaceId,
        thread.title,
        thread.status,
        thread.currentTurnId,
        thread.createdAt,
        now,
      ],
    )
    deps.database.execute(
      `INSERT OR REPLACE INTO provider_runtime_sessions (thread_id, provider, status, last_error, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [thread.id, "stub", "idle", null, now],
    )
  })

  appendEvent(deps, "thread.created", { thread }, { threadId: thread.id, commandId })
  recordReceipt(deps, commandId, "completed", { threadId: thread.id, workspaceId })
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
  const thread = readThread(deps.database, threadId)
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`)
  }

  const workspace = readWorkspace(deps.database, thread.workspaceId)
  if (!workspace) {
    throw new Error(`Workspace not found: ${thread.workspaceId}`)
  }
  assertWorkspaceAcceptsChat(workspace)

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
  refreshFilesystemWorkspaceAvailability(deps.database)

  return {
    getDesktopBootstrap: async () => buildDesktopBootstrap(deps.config),
    getServerConfig: async () => buildServerConfig(),
    getSnapshot: () => getSnapshot(deps),
    createWorkspace: (commandId, rootPath) => createWorkspace(deps, commandId, rootPath),
    relinkWorkspace: (commandId, workspaceId, rootPath) =>
      relinkWorkspace(deps, commandId, workspaceId, rootPath),
    deleteWorkspace: (commandId, workspaceId) => deleteWorkspace(deps, commandId, workspaceId),
    createThread: (commandId, workspaceId, title) =>
      createThread(deps, commandId, workspaceId, title),
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
