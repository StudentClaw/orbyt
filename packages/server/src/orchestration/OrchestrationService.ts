import { existsSync, statSync } from "node:fs"
import path from "node:path"
import { Context, Effect, Layer } from "effect"
import {
  type ChatModel,
  type FeatureFlags,
  PUSH_CHANNELS,
  type CreateThreadResult,
  type CreateWorkspaceResult,
  type DeleteWorkspaceResult,
  type DesktopBootstrap,
  type InterruptTurnResult,
  type OrchestrationDomainEvent,
  type ProviderApprovalDecision,
  type ProviderPendingApproval,
  type OrchestrationSnapshot,
  type OrchestrationThread,
  type OrchestrationTurnAttachment,
  type OrchestrationTurn,
  type OrchestrationWorkspace,
  type ProviderRuntimeEvent,
  type RelinkWorkspaceResult,
  type SendTurnResult,
  type RetryProviderInitializeResult,
  type ServerConfig,
  type StartProviderAuthResult,
  type ThreadAccessMode,
  type TurnAttachmentInput,
  type WorkspaceId,
} from "@student-claw/contracts"
import type {
  DeleteThreadResult,
  RenameThreadResult,
  RespondToProviderApprovalResult,
  SetThreadAccessModeResult,
} from "@student-claw/contracts"
import { createId } from "@student-claw/shared-runtime"
import { recordWorkflowCompletionActivity } from "../activity/feed.js"
import { CodexCli, ProviderRuntimeFailure } from "../ai/CodexCli.js"
import { ProviderRuntimeStore } from "../ai/ProviderRuntimeStore.js"
import type { AppConfig } from "../config/defaults.js"
import { ConfigService } from "../config/ConfigService.js"
import { Database, type DatabaseService } from "../db/Database.js"
import { ServerReadiness, type ServerReadinessService } from "../runtime/ServerReadiness.js"
import { PushBus, type PushBusService } from "../ws/PushBus.js"
import { RuntimeReceiptBus, type RuntimeReceiptBusService } from "./RuntimeReceiptBus.js"
import { tokenizeStubResponse } from "./StubProvider.js"
import {
  ThreadRuntimeBusyError,
  ThreadRuntimeManager,
} from "./ThreadRuntimeManager.js"

const LEGACY_WORKSPACE_ID = "workspace_legacy" as WorkspaceId
type ProviderThreadScopedEvent = Extract<ProviderRuntimeEvent, { readonly threadId: unknown; readonly turnId: unknown }>
type ProviderThreadId = ProviderThreadScopedEvent["threadId"]
type ProviderTurnId = ProviderThreadScopedEvent["turnId"]

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
  access_mode: OrchestrationThread["accessMode"]
  status: OrchestrationThread["status"]
  current_turn_id: string | null
  created_at: string
}

type TurnRow = {
  id: string
  thread_id: string
  input_text: string
  output_text: string
  reasoning_text: string
  status: OrchestrationTurn["status"]
  started_at: string
  completed_at: string | null
}

type TurnAttachmentRow = {
  id: string
  turn_id: string
  path: string
  name: string
  mime_type: string | null
  size_bytes: number | null
  kind: OrchestrationTurnAttachment["kind"]
  position: number
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
  readonly model?: string | null
}

type ActiveTurnState = {
  readonly interrupted: boolean
}

type OrchestrationRuntimeState = {
  readonly activeTurns: Map<string, ActiveTurnState>
  readonly workQueue: WorkItem[]
  drainingQueue: boolean
}

export type OrchestrationRuntimeDeps = {
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
  readonly renameThread: (commandId: string, threadId: string, title: string) => Promise<RenameThreadResult>
  readonly setThreadAccessMode: (
    commandId: string,
    threadId: string,
    accessMode: ThreadAccessMode,
  ) => Promise<SetThreadAccessModeResult>
  readonly deleteThread: (commandId: string, threadId: string) => Promise<DeleteThreadResult>
  readonly sendTurn: (
    commandId: string,
    threadId: string,
    content: string,
    attachments: readonly TurnAttachmentInput[],
    model?: string | null,
  ) => Promise<SendTurnResult>
  readonly interruptTurn: (commandId: string, threadId: string) => Promise<InterruptTurnResult>
  readonly startProviderAuth: (commandId: string) => Promise<StartProviderAuthResult>
  readonly retryProviderInitialize: (commandId: string) => Promise<RetryProviderInitializeResult>
  readonly respondToProviderApproval: (
    commandId: string,
    approvalRequestId: string,
    decision: ProviderApprovalDecision,
  ) => Promise<RespondToProviderApprovalResult>
  readonly shutdown: () => Promise<void>
}

/**
 * Effect service tag for the orchestration runtime facade.
 */
export class OrchestrationService extends Context.Tag("OrchestrationService")<
  OrchestrationService,
  OrchestrationServiceShape
>() {}

export function createRuntimeState(): OrchestrationRuntimeState {
  return {
    activeTurns: new Map(),
    workQueue: [],
    drainingQueue: false,
  }
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getFeatureFlags(): FeatureFlags {
  return {
    pluginSystem: true,
  }
}

const BASE_CHAT_MODELS: readonly ChatModel[] = [
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    description: "Best general-purpose model",
    group: "standard",
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    description: "Fast default model",
    group: "standard",
  },
  {
    id: "gpt-5.3-codex",
    label: "GPT-5.3 Codex",
    description: "Best coding-focused option",
    group: "standard",
  },
]

function buildChatModels(config: AppConfig): ReadonlyArray<ChatModel> {
  if (BASE_CHAT_MODELS.some((model) => model.id === config.codexModel)) {
    return BASE_CHAT_MODELS
  }

  return [
    {
      id: config.codexModel,
      label: config.codexModel,
      description: "Configured default model",
      group: "standard",
    },
    ...BASE_CHAT_MODELS,
  ]
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
    accessMode: row.access_mode,
    status: row.status,
    createdAt: row.created_at,
    currentTurnId: row.current_turn_id as OrchestrationThread["currentTurnId"],
  }
}

function mapTurnAttachmentRow(row: TurnAttachmentRow): OrchestrationTurnAttachment {
  return {
    id: row.id,
    path: row.path,
    name: row.name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    kind: row.kind,
  }
}

function mapTurnRow(
  row: TurnRow,
  attachments: readonly OrchestrationTurnAttachment[] = [],
): OrchestrationTurn {
  return {
    id: row.id as OrchestrationTurn["id"],
    threadId: row.thread_id as OrchestrationTurn["threadId"],
    input: row.input_text,
    output: row.output_text,
    reasoning: row.reasoning_text,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    skill: null,
    attachments: [...attachments],
  }
}

function readTurnAttachments(
  database: DatabaseService,
  turnId: string,
): readonly OrchestrationTurnAttachment[] {
  return database.query<TurnAttachmentRow>(
    `SELECT id, turn_id, path, name, mime_type, size_bytes, kind, position
     FROM orchestration_turn_attachments
     WHERE turn_id = ?
     ORDER BY position ASC`,
    [turnId],
  ).map(mapTurnAttachmentRow)
}

function readTurnAttachmentsByTurnIds(
  database: DatabaseService,
  turnIds: readonly string[],
): ReadonlyMap<string, readonly OrchestrationTurnAttachment[]> {
  if (turnIds.length === 0) {
    return new Map()
  }

  const placeholders = turnIds.map(() => "?").join(", ")
  const rows = database.query<TurnAttachmentRow>(
    `SELECT id, turn_id, path, name, mime_type, size_bytes, kind, position
     FROM orchestration_turn_attachments
     WHERE turn_id IN (${placeholders})
     ORDER BY turn_id ASC, position ASC`,
    [...turnIds],
  )

  const grouped = new Map<string, OrchestrationTurnAttachment[]>()
  for (const row of rows) {
    const entries = grouped.get(row.turn_id) ?? []
    entries.push(mapTurnAttachmentRow(row))
    grouped.set(row.turn_id, entries)
  }

  return grouped
}

function persistTurnAttachments(
  database: DatabaseService,
  turnId: string,
  attachments: readonly OrchestrationTurnAttachment[],
): void {
  attachments.forEach((attachment, index) => {
    database.execute(
      `INSERT INTO orchestration_turn_attachments (
         id, turn_id, path, name, mime_type, size_bytes, kind, position
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attachment.id,
        turnId,
        attachment.path,
        attachment.name,
        attachment.mimeType,
        attachment.sizeBytes,
        attachment.kind,
        index,
      ],
    )
  })
}

function deleteTurnAttachmentsForThreadIds(
  database: DatabaseService,
  threadIds: readonly string[],
): void {
  if (threadIds.length === 0) {
    return
  }

  const placeholders = threadIds.map(() => "?").join(", ")
  database.execute(
    `DELETE FROM orchestration_turn_attachments
     WHERE turn_id IN (
       SELECT id
       FROM orchestration_turns
       WHERE thread_id IN (${placeholders})
     )`,
    [...threadIds],
  )
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
    `SELECT id, workspace_id, title, access_mode, status, current_turn_id, created_at
     FROM orchestration_threads
     WHERE id = ?`,
    [threadId],
  )
  return row ? mapThreadRow(row) : null
}

function readTurn(database: DatabaseService, turnId: string): OrchestrationTurn | null {
  const row = database.get<TurnRow>(
    `SELECT id, thread_id, input_text, output_text, reasoning_text, status, started_at, completed_at
     FROM orchestration_turns
     WHERE id = ?`,
    [turnId],
  )
  return row ? mapTurnRow(row, readTurnAttachments(database, turnId)) : null
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

function readThreadSessionCwd(database: DatabaseService, threadId: string): string | null {
  const thread = readThread(database, threadId)
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`)
  }

  const workspace = readWorkspace(database, thread.workspaceId)
  if (!workspace) {
    throw new Error(`Workspace not found: ${thread.workspaceId}`)
  }

  return workspace.kind === "filesystem" ? workspace.rootPath : null
}

function resolveThreadExecutionCwd(database: DatabaseService, threadId: string): string | null {
  const thread = readThread(database, threadId)
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`)
  }

  const workspace = readWorkspace(database, thread.workspaceId)
  if (!workspace) {
    throw new Error(`Workspace not found: ${thread.workspaceId}`)
  }

  assertWorkspaceAcceptsChat(workspace)
  return workspace.kind === "filesystem" ? workspace.rootPath : null
}

function resetWorkspaceThreadProviderSessions(
  database: DatabaseService,
  workspaceId: string,
  cwd: string,
  updatedAt: string,
): void {
  database.execute(
    `UPDATE provider_runtime_sessions
     SET provider_thread_id = NULL,
         last_error = NULL,
         cwd = ?,
         updated_at = ?
     WHERE thread_id IN (
       SELECT id
       FROM orchestration_threads
       WHERE workspace_id = ?
     )`,
    [cwd, updatedAt, workspaceId],
  )
}

function resetThreadProviderSession(
  database: DatabaseService,
  threadId: string,
  updatedAt: string,
): void {
  database.execute(
    `UPDATE provider_runtime_sessions
     SET provider_thread_id = NULL,
         last_error = NULL,
         updated_at = ?
     WHERE thread_id = ?`,
    [updatedAt, threadId],
  )
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
      `UPDATE provider_runtime_sessions
       SET status = 'interrupted',
           provider_thread_id = NULL,
           auth_state = COALESCE(auth_state, 'unknown'),
           updated_at = ?
       WHERE status IN ('queued', 'streaming')
          OR thread_id IN (
            SELECT id
            FROM orchestration_threads
            WHERE status IN ('queued', 'streaming')
               OR current_turn_id IN (
                 SELECT id
                 FROM orchestration_turns
                 WHERE status IN ('pending', 'queued', 'streaming')
               )
          )`,
      [now],
    )
    database.execute(
      `UPDATE orchestration_threads
       SET status = 'interrupted',
           current_turn_id = NULL,
           updated_at = ?
       WHERE status IN ('queued', 'streaming')
          OR current_turn_id IN (
            SELECT id
            FROM orchestration_turns
            WHERE status IN ('pending', 'queued', 'streaming')
          )`,
      [now],
    )
    database.execute(
      `UPDATE orchestration_turns
       SET status = 'interrupted',
           completed_at = COALESCE(completed_at, ?),
           updated_at = ?
       WHERE status IN ('pending', 'queued', 'streaming')`,
      [now, now],
    )
    database.execute(`DELETE FROM queued_provider_turns`)
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
  const sessionCwd = readThreadSessionCwd(database, work.threadId)

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
      `INSERT OR REPLACE INTO provider_runtime_sessions (
         thread_id, provider, status, last_error, updated_at,
         provider_thread_id, auth_state, runtime_payload, cwd
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [work.threadId, "stub", interrupted ? "interrupted" : "idle", null, completedAt, null, "unknown", null, sessionCwd],
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
    threadId: work.threadId as ProviderThreadId,
    turnId: work.turnId as ProviderTurnId,
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
    threadId: work.threadId as ProviderThreadId,
    turnId: work.turnId as ProviderTurnId,
    output,
  })
  try {
    await recordWorkflowCompletionActivity({
      database: deps.database,
      pushBus: deps.pushBus,
      turn: {
        id: turn.id,
        threadId: turn.threadId,
        output,
      },
    })
  } catch (error) {
    process.stderr.write(`Failed to record workflow activity: ${String(error)}\n`)
  }
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
    threadId: work.threadId as ProviderThreadId,
    turnId: work.turnId as ProviderTurnId,
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
  const sessionCwd = readThreadSessionCwd(database, work.threadId)
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
      `INSERT OR REPLACE INTO provider_runtime_sessions (
         thread_id, provider, status, last_error, updated_at,
         provider_thread_id, auth_state, runtime_payload, cwd
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        work.threadId,
        "stub",
        "interrupted",
        error instanceof Error ? error.message : "Unknown orchestration error",
        now,
        null,
        "unknown",
        null,
        sessionCwd,
      ],
    )
  })
}

async function processWork(
  deps: OrchestrationRuntimeDeps,
  work: WorkItem,
): Promise<void> {
  try {
    const now = new Date().toISOString()
    deps.database.transaction(() => {
      deps.database.execute(
        `UPDATE orchestration_turns
         SET status = 'streaming', updated_at = ?
         WHERE id = ?`,
        [now, work.turnId],
      )
      deps.database.execute(
        `UPDATE orchestration_threads
         SET status = 'streaming', current_turn_id = ?, updated_at = ?
         WHERE id = ?`,
        [work.turnId, now, work.threadId],
      )
      deps.database.execute(
        `UPDATE provider_runtime_sessions
         SET status = ?, last_error = NULL, updated_at = ?
         WHERE thread_id = ?`,
        ["streaming", now, work.threadId],
      )
    })

    const startedTurn = readTurn(deps.database, work.turnId)
    if (startedTurn) {
      appendEvent(deps, "turn.started", { turn: startedTurn }, work)
      await publishDomainEvent(deps.pushBus, { type: "turn.started", turn: startedTurn })
    }
    await publishRuntimeEvent(deps.pushBus, {
      type: "provider.turnStarted",
      threadId: work.threadId as ProviderThreadId,
      turnId: work.turnId as ProviderTurnId,
    })

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
    featureFlags: getFeatureFlags(),
  }
}

function buildServerConfig(config: AppConfig): ServerConfig {
  return {
    appVersion: "0.1.0",
    platform: process.platform,
    protocolVersion: "rpc-v1",
    capabilities: {
      orchestration: true,
      providerRuntime: true,
      desktopBootstrap: true,
    },
    defaultChatModel: config.codexModel,
    chatModels: buildChatModels(config),
    featureFlags: getFeatureFlags(),
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
    `SELECT id, workspace_id, title, access_mode, status, current_turn_id, created_at
     FROM orchestration_threads
     ORDER BY created_at ASC`,
  ).map(mapThreadRow)

  const turnRows = deps.database.query<TurnRow>(
    `SELECT id, thread_id, input_text, output_text, reasoning_text, status, started_at, completed_at
     FROM orchestration_turns
     ORDER BY started_at ASC`,
  )
  const attachmentsByTurnId = readTurnAttachmentsByTurnIds(
    deps.database,
    turnRows.map((row) => row.id),
  )
  const turns = turnRows.map((row) => mapTurnRow(row, attachmentsByTurnId.get(row.id) ?? []))

  const provider = deps.database.get<{
    provider: "stub" | "codex"
    status: OrchestrationSnapshot["providerStatus"]
    auth_state: "unknown" | "authenticated" | "auth_required" | "expired"
    last_error_code: string | null
    last_error_message: string | null
    last_updated_at: string
  }>(
    `SELECT provider, status, auth_state, last_error_code, last_error_message, last_updated_at
     FROM provider_runtime_state
     WHERE provider = 'codex'`,
  )

  return {
    workspaces,
    threads,
    turns,
    pendingApprovals: [],
    providerStatus: provider?.status ?? "offline",
    providerRuntime: {
      adapter: provider?.provider === "codex" ? "codex" : "stub",
      status: provider?.status ?? "offline",
      authState: provider?.auth_state ?? "unknown",
      lastError: provider?.last_error_code && provider?.last_error_message
        ? {
            code: provider.last_error_code,
            message: provider.last_error_message,
          }
        : null,
      queuedTurnCount: deps.state.workQueue.length,
      lastUpdatedAt: provider?.last_updated_at ?? new Date(0).toISOString(),
    },
    chatSendReady: true,
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
    accessMode: "default",
    status: "idle",
    createdAt: now,
    currentTurnId: null,
  }
}

function normalizeThreadTitle(title: string): string {
  const normalized = title.trim()
  if (normalized.length === 0) {
    throw new Error("Thread title is required")
  }

  return normalized
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
  resetWorkspaceThreadProviderSessions(deps.database, workspaceId, rootPath, now)

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
      deleteTurnAttachmentsForThreadIds(deps.database, deletedThreadIds)
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
  const sessionCwd = workspace.kind === "filesystem" ? workspace.rootPath : null

  deps.database.transaction(() => {
    deps.database.execute(
      `INSERT INTO orchestration_threads (
         id, workspace_id, title, access_mode, status, current_turn_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        thread.id,
        thread.workspaceId,
        thread.title,
        thread.accessMode,
        thread.status,
        thread.currentTurnId,
        thread.createdAt,
        now,
      ],
    )
    deps.database.execute(
      `INSERT OR REPLACE INTO provider_runtime_sessions (
         thread_id, provider, status, last_error, updated_at,
         provider_thread_id, auth_state, runtime_payload, cwd
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [thread.id, "stub", "idle", null, now, null, "unknown", null, sessionCwd],
    )
  })

  appendEvent(deps, "thread.created", { thread }, { threadId: thread.id, commandId })
  recordReceipt(deps, commandId, "completed", { threadId: thread.id, workspaceId })
  await publishDomainEvent(deps.pushBus, { type: "thread.created", thread })
  await deps.receiptBus.resolve(commandId, { threadId: thread.id })
  return { threadId: thread.id }
}

async function renameThread(
  deps: OrchestrationRuntimeDeps,
  commandId: string,
  threadId: string,
  title: string,
): Promise<RenameThreadResult> {
  const thread = readThread(deps.database, threadId)
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`)
  }

  const normalizedTitle = normalizeThreadTitle(title)
  const now = new Date().toISOString()

  deps.database.execute(
    `UPDATE orchestration_threads
     SET title = ?, updated_at = ?
     WHERE id = ?`,
    [normalizedTitle, now, threadId],
  )

  const updatedThread = readThread(deps.database, threadId)
  if (!updatedThread) {
    throw new Error(`Thread not found after rename: ${threadId}`)
  }

  appendEvent(deps, "thread.updated", { thread: updatedThread }, { threadId, commandId })
  recordReceipt(deps, commandId, "completed", { threadId, workspaceId: updatedThread.workspaceId })
  await publishDomainEvent(deps.pushBus, { type: "thread.updated", thread: updatedThread })
  await deps.receiptBus.resolve(commandId, { threadId })
  return { threadId: updatedThread.id }
}

async function setThreadAccessMode(
  deps: OrchestrationRuntimeDeps,
  commandId: string,
  threadId: string,
  accessMode: ThreadAccessMode,
): Promise<SetThreadAccessModeResult> {
  const thread = readThread(deps.database, threadId)
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`)
  }

  if (thread.currentTurnId) {
    throw new Error("Cannot change access mode while a turn is active.")
  }

  if (thread.accessMode === accessMode) {
    recordReceipt(deps, commandId, "completed", { threadId, accessMode })
    await deps.receiptBus.resolve(commandId, { threadId, accessMode })
    return { threadId: thread.id, accessMode }
  }

  const now = new Date().toISOString()
  deps.database.transaction(() => {
    deps.database.execute(
      `UPDATE orchestration_threads
       SET access_mode = ?, updated_at = ?
       WHERE id = ?`,
      [accessMode, now, threadId],
    )
    resetThreadProviderSession(deps.database, threadId, now)
  })

  const updatedThread = readThread(deps.database, threadId)
  if (!updatedThread) {
    throw new Error(`Thread not found after access mode update: ${threadId}`)
  }

  appendEvent(deps, "thread.updated", { thread: updatedThread }, { threadId, commandId })
  recordReceipt(deps, commandId, "completed", { threadId, accessMode })
  await publishDomainEvent(deps.pushBus, { type: "thread.updated", thread: updatedThread })
  await deps.receiptBus.resolve(commandId, { threadId, accessMode })
  return { threadId: updatedThread.id, accessMode }
}

async function deleteThread(
  deps: OrchestrationRuntimeDeps,
  commandId: string,
  threadId: string,
): Promise<DeleteThreadResult> {
  const thread = readThread(deps.database, threadId)
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`)
  }

  if (thread.currentTurnId) {
    deps.state.activeTurns.delete(thread.currentTurnId)
  }

  const remainingQueue = deps.state.workQueue.filter((item) => item.threadId !== threadId)
  deps.state.workQueue.splice(0, deps.state.workQueue.length, ...remainingQueue)

  deps.database.transaction(() => {
    deleteTurnAttachmentsForThreadIds(deps.database, [threadId])
    deps.database.execute(`DELETE FROM orchestration_turns WHERE thread_id = ?`, [threadId])
    deps.database.execute(`DELETE FROM provider_runtime_sessions WHERE thread_id = ?`, [threadId])
    deps.database.execute(`DELETE FROM orchestration_threads WHERE id = ?`, [threadId])
  })

  appendEvent(deps, "thread.deleted", { threadId, workspaceId: thread.workspaceId }, { threadId, commandId })
  recordReceipt(deps, commandId, "completed", {
    deleted: true,
    threadId,
    workspaceId: thread.workspaceId,
  })
  await publishDomainEvent(deps.pushBus, { type: "thread.deleted", threadId: thread.id, workspaceId: thread.workspaceId })
  await deps.receiptBus.resolve(commandId, { deleted: true, threadId })
  return { deleted: true }
}

function buildTurnAttachments(
  attachments: readonly TurnAttachmentInput[],
): readonly OrchestrationTurnAttachment[] {
  return attachments.map((attachment) => ({
    id: createId("attachment"),
    path: attachment.path,
    name: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    kind: attachment.kind,
  }))
}

function buildQueuedTurn(
  threadId: string,
  content: string,
  attachments: readonly TurnAttachmentInput[],
): OrchestrationTurn {
  const now = new Date().toISOString()
  return {
    id: createId("turn") as OrchestrationTurn["id"],
    threadId: threadId as OrchestrationTurn["threadId"],
    input: content,
    output: "",
    reasoning: "",
    status: "queued",
    startedAt: now,
    completedAt: null,
    skill: null,
    attachments: buildTurnAttachments(attachments),
  }
}

async function sendTurn(
  deps: OrchestrationRuntimeDeps,
  commandId: string,
  threadId: string,
  content: string,
  attachments: readonly TurnAttachmentInput[],
  model?: string | null,
): Promise<SendTurnResult> {
  const thread = readThread(deps.database, threadId)
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`)
  }
  if (thread.currentTurnId && (thread.status === "queued" || thread.status === "streaming")) {
    throw new Error("Wait for the current turn to finish before sending another message.")
  }

  const workspace = readWorkspace(deps.database, thread.workspaceId)
  if (!workspace) {
    throw new Error(`Workspace not found: ${thread.workspaceId}`)
  }
  assertWorkspaceAcceptsChat(workspace)

  const turn = buildQueuedTurn(threadId, content, attachments)
  const now = new Date().toISOString()
  const sessionCwd = workspace.kind === "filesystem" ? workspace.rootPath : null
  await deps.receiptBus.track(commandId)

  deps.database.transaction(() => {
    deps.database.execute(
      `INSERT INTO orchestration_turns (id, thread_id, input_text, output_text, status, started_at, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [turn.id, turn.threadId, turn.input, turn.output, turn.status, turn.startedAt, turn.completedAt, now],
    )
    persistTurnAttachments(deps.database, turn.id, turn.attachments)
    deps.database.execute(
      `UPDATE orchestration_threads
       SET status = ?, current_turn_id = ?, updated_at = ?
       WHERE id = ?`,
      ["queued", turn.id, now, threadId],
    )
    deps.database.execute(
      `INSERT OR REPLACE INTO provider_runtime_sessions (
         thread_id, provider, status, last_error, updated_at,
         provider_thread_id, auth_state, runtime_payload, cwd
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [threadId, "stub", "idle", null, now, null, "unknown", null, sessionCwd],
    )
    recordReceipt(deps, commandId, "pending", { threadId, turnId: turn.id })
  })

  deps.state.activeTurns.set(turn.id, { interrupted: false })
  appendEvent(deps, "turn.queued", { turn }, { threadId, turnId: turn.id, commandId })
  await publishDomainEvent(deps.pushBus, { type: "turn.queued", turn })
  deps.state.workQueue.push({ commandId, threadId, turnId: turn.id, content, model })
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

export function createOrchestrationService(deps: OrchestrationRuntimeDeps): OrchestrationServiceShape {
  reconcileStaleStreamingState(deps.database)
  refreshFilesystemWorkspaceAvailability(deps.database)

  return {
    getDesktopBootstrap: async () => buildDesktopBootstrap(deps.config),
    getServerConfig: async () => buildServerConfig(deps.config),
    getSnapshot: () => getSnapshot(deps),
    createWorkspace: (commandId, rootPath) => createWorkspace(deps, commandId, rootPath),
    relinkWorkspace: (commandId, workspaceId, rootPath) =>
      relinkWorkspace(deps, commandId, workspaceId, rootPath),
    deleteWorkspace: (commandId, workspaceId) => deleteWorkspace(deps, commandId, workspaceId),
    createThread: (commandId, workspaceId, title) =>
      createThread(deps, commandId, workspaceId, title),
    renameThread: (commandId, threadId, title) =>
      renameThread(deps, commandId, threadId, title),
    setThreadAccessMode: (commandId, threadId, accessMode) =>
      setThreadAccessMode(deps, commandId, threadId, accessMode),
    deleteThread: (commandId, threadId) =>
      deleteThread(deps, commandId, threadId),
    sendTurn: (commandId, threadId, content, attachments, model) =>
      sendTurn(deps, commandId, threadId, content, attachments, model),
    interruptTurn: (commandId, threadId) => interruptTurn(deps, commandId, threadId),
    startProviderAuth: async () => ({ started: false }),
    retryProviderInitialize: async () => ({ started: false }),
    respondToProviderApproval: async (_commandId, approvalRequestId) => ({
      approvalRequestId,
      resolved: false,
    }),
    shutdown: async () => undefined,
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
    const runtimeStore = yield* ProviderRuntimeStore
    const codexCli = yield* CodexCli
    const threadRuntimeManager = yield* ThreadRuntimeManager
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
        `SELECT id, workspace_id, title, access_mode, status, current_turn_id, created_at
         FROM orchestration_threads
         WHERE id = ?`,
        [threadId],
      )
      if (!row) return null
      return {
        id: row.id as OrchestrationThread["id"],
        workspaceId: row.workspace_id as WorkspaceId,
        title: row.title,
        accessMode: row.access_mode,
        status: row.status,
        createdAt: row.created_at,
        currentTurnId: row.current_turn_id as OrchestrationThread["currentTurnId"],
      }
    }

    const readTurn = (turnId: string): OrchestrationTurn | null => {
      const row = database.get<TurnRow>(
        `SELECT id, thread_id, input_text, output_text, reasoning_text, status, started_at, completed_at
         FROM orchestration_turns
         WHERE id = ?`,
        [turnId],
      )
      return row ? mapTurnRow(row, readTurnAttachments(database, turnId)) : null
    }

    const publishDomainEvent = async (event: OrchestrationDomainEvent): Promise<void> => {
      await pushBus.publish(PUSH_CHANNELS.ORCHESTRATION_DOMAIN, event)
    }

    const publishRuntimeEvent = async (event: ProviderRuntimeEvent): Promise<void> => {
      await pushBus.publish(PUSH_CHANNELS.PROVIDER_RUNTIME, event)
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
      })

      await runtimeStore.upsertThreadSession(threadId, {
        status: interrupted ? "interrupted" : "idle",
        lastError: null,
      })

      const turn = readTurn(turnId)
      if (!turn) return

      if (interrupted) {
        appendEvent("turn.interrupted", { turn }, { threadId, turnId, commandId })
        recordReceipt(commandId, "interrupted", { turnId, threadId })
        await publishRuntimeEvent({
          type: "provider.turnInterrupted",
          threadId: threadId as never,
          turnId: turnId as never,
        })
        await publishDomainEvent({ type: "turn.interrupted", turn })
      } else {
        appendEvent("turn.completed", { turn }, { threadId, turnId, commandId })
        recordReceipt(commandId, "completed", { turnId, threadId })
        await publishRuntimeEvent({
          type: "provider.turnCompleted",
          threadId: threadId as never,
          turnId: turnId as never,
          output,
        })
        try {
          await recordWorkflowCompletionActivity({
            database,
            pushBus,
            turn: {
              id: turn.id,
              threadId: turn.threadId,
              output,
            },
          })
        } catch (error) {
          process.stderr.write(`Failed to record workflow activity: ${String(error)}\n`)
        }
        await publishDomainEvent({ type: "turn.completed", turn })
      }

      await receiptBus.resolve(commandId, { turnId, threadId, status: turnStatus })
      activeTurns.delete(turnId)
    }

    const requeueTurn = async (work: WorkItem): Promise<void> => {
      const queued = await runtimeStore.listQueuedTurns()
      if (queued.some((entry) => entry.turnId === work.turnId)) {
        return
      }
      await runtimeStore.enqueueTurn(work.turnId, work.threadId, work.content)
      workQueue.push(work)
    }

    const markTurnStreaming = async (work: WorkItem): Promise<void> => {
      const now = new Date().toISOString()
      database.transaction(() => {
        database.execute(
          `UPDATE orchestration_turns
           SET status = 'streaming', updated_at = ?
           WHERE id = ?`,
          [now, work.turnId],
        )
        database.execute(
          `UPDATE orchestration_threads
           SET status = 'streaming', current_turn_id = ?, updated_at = ?
           WHERE id = ?`,
          [work.turnId, now, work.threadId],
        )
      })
      await runtimeStore.upsertThreadSession(work.threadId, {
        status: "streaming",
        lastError: null,
      })
    }

    const failTurn = async (
      work: WorkItem,
      error: ProviderRuntimeFailure | Error,
      allowRetry: boolean,
    ): Promise<void> => {
      const message = error.message || "Unknown orchestration error"
      const retryable = error instanceof ProviderRuntimeFailure ? error.retryable : false
      const now = new Date().toISOString()

      if (allowRetry && retryable) {
        database.transaction(() => {
          database.execute(
            `UPDATE orchestration_turns
             SET status = 'queued', updated_at = ?
             WHERE id = ?`,
            [now, work.turnId],
          )
          database.execute(
            `UPDATE orchestration_threads
             SET status = 'queued', current_turn_id = ?, updated_at = ?
             WHERE id = ?`,
            [work.turnId, now, work.threadId],
          )
        })
        await runtimeStore.upsertThreadSession(work.threadId, {
          status: "offline",
          lastError: message,
        })
        await requeueTurn(work)
        return
      }

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
      })
      await runtimeStore.upsertThreadSession(work.threadId, {
        status: "interrupted",
        lastError: message,
      })
      activeTurns.delete(work.turnId)
    }

    const processWork = async (work: WorkItem): Promise<void> => {
      try {
        const runtimeState = await runtimeStore.getState()
        if (runtimeState.status === "auth_required") {
          await failTurn(
            work,
            new ProviderRuntimeFailure(
              "codex_auth_required",
              "Codex CLI is not authenticated. Start auth and retry.",
              false,
            ),
            false,
          )
          return
        }

        await runtimeStore.dequeueTurn(work.turnId)
        await markTurnStreaming(work)
        await publishRuntimeEvent({
          type: "provider.turnStarted",
          threadId: work.threadId as never,
          turnId: work.turnId as never,
        })

        const executionCwd = resolveThreadExecutionCwd(database, work.threadId)
        const thread = readThread(work.threadId)
        await codexCli.streamTurn({
          localThreadId: work.threadId,
          localTurnId: work.turnId,
          content: work.content,
          cwd: executionCwd,
          accessMode: thread?.accessMode ?? "default",
          model: work.model,
          onToken: async (token, index) => {
            if (activeTurns.get(work.turnId)?.interrupted) {
              const interrupted = await codexCli.interruptTurn(work.threadId, work.turnId)
              if (!interrupted) {
                await completeTurn(work.commandId, work.threadId, work.turnId, readTurn(work.turnId)?.output ?? "", true)
              }
              return
            }

            const current = readTurn(work.turnId)
            const output = `${current?.output ?? ""}${token}`

            database.execute(
              `UPDATE orchestration_turns
               SET output_text = ?, updated_at = ?
               WHERE id = ?`,
              [output, new Date().toISOString(), work.turnId],
            )

            await publishRuntimeEvent({
              type: "provider.token",
              threadId: work.threadId as never,
              turnId: work.turnId as never,
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
          },
          onReasoning: async (token, index) => {
            const current = readTurn(work.turnId)
            const reasoning = `${current?.reasoning ?? ""}${token}`

            database.execute(
              `UPDATE orchestration_turns
               SET reasoning_text = ?, updated_at = ?
               WHERE id = ?`,
              [reasoning, new Date().toISOString(), work.turnId],
            )

            await publishRuntimeEvent({
              type: "provider.reasoning",
              threadId: work.threadId as never,
              turnId: work.turnId as never,
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
          },
          onCompleted: async () => {
            const output = readTurn(work.turnId)?.output ?? ""
            await completeTurn(work.commandId, work.threadId, work.turnId, output, false)
          },
          onInterrupted: async () => {
            const output = readTurn(work.turnId)?.output ?? ""
            await completeTurn(work.commandId, work.threadId, work.turnId, output, true)
          },
          onError: async (error) => {
            await failTurn(work, error, true)
          },
          onMcpToolCall: async (event) => {
            await publishRuntimeEvent(event)
          },
          onApprovalRequest: async (approval) => {
            await publishRuntimeEvent({
              type: "provider.approvalRequested",
              approval,
            })
          },
        })
      } catch (error) {
        await failTurn(
          work,
          error instanceof ProviderRuntimeFailure
            ? error
            : new ProviderRuntimeFailure(
                "codex_turn_failed",
                error instanceof Error ? error.message : "Unknown orchestration error",
                true,
              ),
          true,
        )
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

    reconcileStaleStreamingState(database)
    void runtimeStore.refreshQueuedCount()

    return {
      getDesktopBootstrap: async () => ({
        wsUrl: `ws://127.0.0.1:${config.port}`,
        wsAuthToken: config.wsAuthToken,
        appVersion: "0.1.0",
        platform: process.platform,
        featureFlags: getFeatureFlags(),
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
        defaultChatModel: config.codexModel,
        chatModels: buildChatModels(config),
        featureFlags: getFeatureFlags(),
      }),
      getSnapshot: async () => {
        refreshFilesystemWorkspaceAvailability(database)

        const workspaces = database.query<WorkspaceRow>(
          `SELECT id, kind, name, root_path, availability, created_at, updated_at
           FROM chat_workspaces
           ORDER BY created_at ASC`,
        ).map(mapWorkspaceRow)
        const threads = database.query<ThreadRow>(
          `SELECT id, workspace_id, title, access_mode, status, current_turn_id, created_at
           FROM orchestration_threads
           ORDER BY created_at ASC`,
        ).map(mapThreadRow)
        const turnRows = database.query<TurnRow>(
          `SELECT id, thread_id, input_text, output_text, reasoning_text, status, started_at, completed_at
           FROM orchestration_turns
           ORDER BY started_at ASC`,
        )
        const attachmentsByTurnId = readTurnAttachmentsByTurnIds(
          database,
          turnRows.map((row) => row.id),
        )
        const turns = turnRows.map((row) => mapTurnRow(row, attachmentsByTurnId.get(row.id) ?? []))
        const providerRuntime = await runtimeStore.getState()
        const runtimeSnapshot = threadRuntimeManager.getSnapshot()
        return {
          workspaces,
          threads,
          turns,
          pendingApprovals: threadRuntimeManager.listPendingApprovals(),
          providerStatus: providerRuntime.status,
          providerRuntime,
          chatSendReady: runtimeSnapshot.acceptingTurns,
          ready: readiness.isReady(),
          lastSequence: pushBus.getLastSequence(),
        }
      },
      createWorkspace: async (commandId, rootPath) => {
        const normalized = normalizeRootPath(rootPath)
        if (!isDirectoryPath(normalized)) {
          throw new Error(`Workspace folder not found: ${normalized}`)
        }

        const existing = readFilesystemWorkspaceByRootPath(database, normalized)
        if (existing) {
          if (existing.kind === "filesystem" && existing.availability !== "ready") {
            updateWorkspaceAvailability(database, existing.id, "ready")
            const refreshed = readWorkspace(database, existing.id)
            if (refreshed) {
              appendEvent("workspace.updated", { workspace: refreshed }, { commandId })
              await publishDomainEvent({ type: "workspace.updated", workspace: refreshed })
            }
          }
          recordReceipt(commandId, "completed", { workspaceId: existing.id })
          await receiptBus.resolve(commandId, { workspaceId: existing.id })
          return { workspaceId: existing.id }
        }

        const workspace = buildFilesystemWorkspace(normalized)
        database.execute(
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

        appendEvent("workspace.created", { workspace }, { commandId })
        recordReceipt(commandId, "completed", { workspaceId: workspace.id })
        await publishDomainEvent({ type: "workspace.created", workspace })
        await receiptBus.resolve(commandId, { workspaceId: workspace.id })
        return { workspaceId: workspace.id }
      },
      relinkWorkspace: async (commandId, workspaceId, rawRootPath) => {
        const workspace = readWorkspace(database, workspaceId)
        if (!workspace) {
          throw new Error(`Workspace not found: ${workspaceId}`)
        }
        if (workspace.kind !== "filesystem") {
          throw new Error("Only filesystem workspaces can be relinked")
        }

        const normalized = normalizeRootPath(rawRootPath)
        if (!isDirectoryPath(normalized)) {
          throw new Error(`Workspace folder not found: ${normalized}`)
        }

        const duplicate = readFilesystemWorkspaceByRootPath(database, normalized)
        if (duplicate && duplicate.id !== workspace.id) {
          throw new Error(`Workspace already exists for folder: ${normalized}`)
        }

        const workspaceThreads = readWorkspaceThreadRows(database, workspaceId)
        const now = new Date().toISOString()
        database.execute(
          `UPDATE chat_workspaces
           SET name = ?, root_path = ?, availability = ?, updated_at = ?
           WHERE id = ?`,
          [deriveWorkspaceName(normalized), normalized, "ready", now, workspaceId],
        )
        resetWorkspaceThreadProviderSessions(database, workspaceId, normalized, now)
        await Promise.allSettled(
          workspaceThreads.map((row) => threadRuntimeManager.disposeThread(row.id)),
        )

        const updatedWorkspace = readWorkspace(database, workspaceId)
        if (!updatedWorkspace) {
          throw new Error(`Workspace not found after relink: ${workspaceId}`)
        }

        appendEvent("workspace.updated", { workspace: updatedWorkspace }, { commandId })
        recordReceipt(commandId, "completed", { workspaceId: updatedWorkspace.id })
        await publishDomainEvent({ type: "workspace.updated", workspace: updatedWorkspace })
        await receiptBus.resolve(commandId, { workspaceId: updatedWorkspace.id })
        return { workspaceId: updatedWorkspace.id }
      },
      deleteWorkspace: async (commandId, workspaceId) => {
        const workspace = readWorkspace(database, workspaceId)
        if (!workspace) {
          throw new Error(`Workspace not found: ${workspaceId}`)
        }

        const threadRows = readWorkspaceThreadRows(database, workspaceId)
        const deletedThreadIds = threadRows.map((row) => row.id as OrchestrationThread["id"])
        await Promise.allSettled(threadRows.map((row) => threadRuntimeManager.disposeThread(row.id)))

        database.transaction(() => {
          if (deletedThreadIds.length > 0) {
            const placeholders = deletedThreadIds.map(() => "?").join(", ")
            deleteTurnAttachmentsForThreadIds(database, deletedThreadIds)
            database.execute(
              `DELETE FROM queued_provider_turns WHERE thread_id IN (${placeholders})`,
              deletedThreadIds,
            )
            database.execute(
              `DELETE FROM orchestration_turns WHERE thread_id IN (${placeholders})`,
              deletedThreadIds,
            )
            database.execute(
              `DELETE FROM provider_runtime_sessions WHERE thread_id IN (${placeholders})`,
              deletedThreadIds,
            )
            database.execute(
              `DELETE FROM orchestration_threads WHERE id IN (${placeholders})`,
              deletedThreadIds,
            )
          }

          database.execute(`DELETE FROM chat_workspaces WHERE id = ?`, [workspaceId])
        })

        appendEvent("workspace.deleted", { workspaceId, deletedThreadIds }, { commandId })
        recordReceipt(commandId, "completed", { deleted: true, workspaceId, deletedThreadIds })
        await publishDomainEvent({
          type: "workspace.deleted",
          workspaceId: workspace.id,
          deletedThreadIds,
        })
        await receiptBus.resolve(commandId, { deleted: true })
        return { deleted: true }
      },
      createThread: async (commandId, workspaceId, title) => {
        const workspace = readWorkspace(database, workspaceId)
        if (!workspace) {
          throw new Error(`Workspace not found: ${workspaceId}`)
        }
        assertWorkspaceAcceptsChat(workspace)

        const thread = buildThread(workspaceId, title)
        const now = new Date().toISOString()
        const sessionCwd = workspace.kind === "filesystem" ? workspace.rootPath : null

        database.transaction(() => {
          database.execute(
            `INSERT INTO orchestration_threads (
               id, workspace_id, title, access_mode, status, current_turn_id, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              thread.id,
              thread.workspaceId,
              thread.title,
              thread.accessMode,
              thread.status,
              thread.currentTurnId,
              thread.createdAt,
              now,
            ],
          )
          database.execute(
            `INSERT OR REPLACE INTO provider_runtime_sessions (
               thread_id, provider, status, last_error, updated_at,
               provider_thread_id, auth_state, runtime_payload, cwd
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [thread.id, "codex", "idle", null, now, null, "unknown", null, sessionCwd],
          )
        })

        appendEvent("thread.created", { thread }, { threadId: thread.id, commandId })
        recordReceipt(commandId, "completed", { threadId: thread.id, workspaceId })
        await publishDomainEvent({ type: "thread.created", thread })
        await receiptBus.resolve(commandId, { threadId: thread.id })
        return { threadId: thread.id }
      },
      renameThread: async (commandId, threadId, title) => {
        const thread = readThread(threadId)
        if (!thread) {
          throw new Error(`Thread not found: ${threadId}`)
        }

        const normalizedTitle = normalizeThreadTitle(title)
        const now = new Date().toISOString()

        database.execute(
          `UPDATE orchestration_threads
           SET title = ?, updated_at = ?
           WHERE id = ?`,
          [normalizedTitle, now, threadId],
        )

        const updatedThread = readThread(threadId)
        if (!updatedThread) {
          throw new Error(`Thread not found after rename: ${threadId}`)
        }

        appendEvent("thread.updated", { thread: updatedThread }, { threadId, commandId })
        recordReceipt(commandId, "completed", { threadId, workspaceId: updatedThread.workspaceId })
        await publishDomainEvent({ type: "thread.updated", thread: updatedThread })
        await receiptBus.resolve(commandId, { threadId })
        return { threadId: updatedThread.id }
      },
      setThreadAccessMode: async (commandId, threadId, accessMode) => {
        const thread = readThread(threadId)
        if (!thread) {
          throw new Error(`Thread not found: ${threadId}`)
        }

        if (thread.currentTurnId) {
          throw new Error("Cannot change access mode while a turn is active.")
        }

        if (thread.accessMode === accessMode) {
          recordReceipt(commandId, "completed", { threadId, accessMode })
          await receiptBus.resolve(commandId, { threadId, accessMode })
          return { threadId: thread.id, accessMode }
        }

        const now = new Date().toISOString()
        database.transaction(() => {
          database.execute(
            `UPDATE orchestration_threads
             SET access_mode = ?, updated_at = ?
             WHERE id = ?`,
            [accessMode, now, threadId],
          )
          resetThreadProviderSession(database, threadId, now)
        })
        await threadRuntimeManager.disposeThread(threadId)

        const updatedThread = readThread(threadId)
        if (!updatedThread) {
          throw new Error(`Thread not found after access mode update: ${threadId}`)
        }

        appendEvent("thread.updated", { thread: updatedThread }, { threadId, commandId })
        recordReceipt(commandId, "completed", { threadId, accessMode })
        await publishDomainEvent({ type: "thread.updated", thread: updatedThread })
        await receiptBus.resolve(commandId, { threadId, accessMode })
        return { threadId: updatedThread.id, accessMode }
      },
      deleteThread: async (commandId, threadId) => {
        const thread = readThread(threadId)
        if (!thread) {
          throw new Error(`Thread not found: ${threadId}`)
        }
        await threadRuntimeManager.disposeThread(threadId)

        database.transaction(() => {
          deleteTurnAttachmentsForThreadIds(database, [threadId])
          database.execute(`DELETE FROM queued_provider_turns WHERE thread_id = ?`, [threadId])
          database.execute(`DELETE FROM orchestration_turns WHERE thread_id = ?`, [threadId])
          database.execute(`DELETE FROM provider_runtime_sessions WHERE thread_id = ?`, [threadId])
          database.execute(`DELETE FROM orchestration_threads WHERE id = ?`, [threadId])
        })

        appendEvent("thread.deleted", { threadId, workspaceId: thread.workspaceId }, { threadId, commandId })
        recordReceipt(commandId, "completed", { deleted: true, threadId, workspaceId: thread.workspaceId })
        await publishDomainEvent({ type: "thread.deleted", threadId: thread.id, workspaceId: thread.workspaceId })
        await receiptBus.resolve(commandId, { deleted: true, threadId })
        return { deleted: true }
      },
      sendTurn: async (commandId, threadId, content, attachments, model) => {
        const runtimeState = await runtimeStore.getState()
        if (!threadRuntimeManager.getSnapshot().acceptingTurns) {
          throw new Error("Codex is still starting. Wait for Student Claw to finish preparing Codex and try again.")
        }

        const thread = readThread(threadId)
        if (!thread) {
          throw new Error(`Thread not found: ${threadId}`)
        }
        if (thread.currentTurnId && (thread.status === "queued" || thread.status === "streaming")) {
          throw new Error("Wait for the current turn to finish before sending another message.")
        }

        if (runtimeState.authState === "auth_required" || runtimeState.status === "auth_required") {
          throw new Error("Codex CLI is not authenticated. Start auth and retry.")
        }

        const turnId = createId("turn")
        const now = new Date().toISOString()
        const turn: OrchestrationTurn = {
          id: turnId as OrchestrationTurn["id"],
          threadId: threadId as OrchestrationTurn["threadId"],
          input: content,
          output: "",
          reasoning: "",
          status: "queued",
          startedAt: now,
          completedAt: null,
          skill: null,
          attachments: buildTurnAttachments(attachments),
        }

        await receiptBus.track(commandId)

        database.transaction(() => {
          database.execute(
            `INSERT INTO orchestration_turns (id, thread_id, input_text, output_text, status, started_at, completed_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [turn.id, turn.threadId, turn.input, turn.output, turn.status, turn.startedAt, turn.completedAt, now],
          )
          persistTurnAttachments(database, turn.id, turn.attachments)
          database.execute(
            `UPDATE orchestration_threads
             SET status = ?, current_turn_id = ?, updated_at = ?
             WHERE id = ?`,
            ["queued", turn.id, now, threadId],
          )
          recordReceipt(commandId, "pending", { threadId, turnId: turn.id })
        })

        await runtimeStore.enqueueTurn(turn.id, threadId, content)
        await runtimeStore.upsertThreadSession(threadId, {
          status: runtimeState.status,
          authState: runtimeState.authState,
        })

        appendEvent("turn.queued", { turn }, { threadId, turnId: turn.id, commandId })
        await publishDomainEvent({ type: "turn.queued", turn })
        const work: WorkItem = { commandId, threadId, turnId: turn.id, content, model }

        try {
          await threadRuntimeManager.submitTurn({
            threadId,
            turnId: turn.id,
            content,
            cwd: resolveThreadExecutionCwd(database, threadId),
            accessMode: thread.accessMode,
            model,
            onStart: async () => {
              await runtimeStore.dequeueTurn(turn.id)
              await markTurnStreaming(work)
              const startedTurn = readTurn(turn.id)
              if (startedTurn) {
                appendEvent("turn.started", { turn: startedTurn }, {
                  threadId,
                  turnId: turn.id,
                  commandId,
                })
                await publishDomainEvent({ type: "turn.started", turn: startedTurn })
              }
              await publishRuntimeEvent({
                type: "provider.turnStarted",
                threadId: threadId as ProviderThreadId,
                turnId: turn.id as ProviderTurnId,
              })
            },
            onToken: async (token, index) => {
              const current = readTurn(turn.id)
              const output = `${current?.output ?? ""}${token}`

              database.execute(
                `UPDATE orchestration_turns
                 SET output_text = ?, updated_at = ?
                 WHERE id = ?`,
                [output, new Date().toISOString(), turn.id],
              )

              await publishRuntimeEvent({
                type: "provider.token",
                threadId: threadId as ProviderThreadId,
                turnId: turn.id as ProviderTurnId,
                token,
                index,
              })

              const updatedTurn = readTurn(turn.id)
              if (updatedTurn) {
                appendEvent("turn.updated", { turn: updatedTurn }, {
                  threadId,
                  turnId: turn.id,
                  commandId,
                })
                await publishDomainEvent({ type: "turn.updated", turn: updatedTurn })
              }
            },
            onReasoning: async (token, index) => {
              const current = readTurn(turn.id)
              const reasoning = `${current?.reasoning ?? ""}${token}`

              database.execute(
                `UPDATE orchestration_turns
                 SET reasoning_text = ?, updated_at = ?
                 WHERE id = ?`,
                [reasoning, new Date().toISOString(), turn.id],
              )

              await publishRuntimeEvent({
                type: "provider.reasoning",
                threadId: threadId as ProviderThreadId,
                turnId: turn.id as ProviderTurnId,
                token,
                index,
              })

              const updatedTurn = readTurn(turn.id)
              if (updatedTurn) {
                appendEvent("turn.updated", { turn: updatedTurn }, {
                  threadId,
                  turnId: turn.id,
                  commandId,
                })
                await publishDomainEvent({ type: "turn.updated", turn: updatedTurn })
              }
            },
            onCompleted: async () => {
              const output = readTurn(turn.id)?.output ?? ""
              await completeTurn(commandId, threadId, turn.id, output, false)
            },
            onInterrupted: async () => {
              const output = readTurn(turn.id)?.output ?? ""
              await completeTurn(commandId, threadId, turn.id, output, true)
            },
            onError: async (error) => {
              const message = error.message || "Unknown orchestration error"
              if (error.retryable) {
                const now = new Date().toISOString()
                database.transaction(() => {
                  database.execute(
                    `UPDATE orchestration_turns
                     SET status = 'queued', updated_at = ?
                     WHERE id = ?`,
                    [now, turn.id],
                  )
                  database.execute(
                    `UPDATE orchestration_threads
                     SET status = 'queued', current_turn_id = ?, updated_at = ?
                     WHERE id = ?`,
                    [turn.id, now, threadId],
                  )
                })
                await runtimeStore.enqueueTurn(turn.id, threadId, content)
                await runtimeStore.upsertThreadSession(threadId, {
                  status: "offline",
                  lastError: message,
                })
                return "retry"
              }

              await runtimeStore.dequeueTurn(turn.id)
              const output = readTurn(turn.id)?.output ?? ""
              await completeTurn(commandId, threadId, turn.id, output, true)
              await runtimeStore.upsertThreadSession(threadId, {
                status: "interrupted",
                lastError: message,
              })
              return "interrupt"
            },
            onMcpToolCall: async (event) => {
              await publishRuntimeEvent(event)
            },
            onApprovalRequest: async (approval) => {
              await publishRuntimeEvent({
                type: "provider.approvalRequested",
                approval,
              })
            },
          })
        } catch (error) {
          if (error instanceof ThreadRuntimeBusyError) {
            throw new Error("Wait for the current turn to finish before sending another message.")
          }
          throw error
        }
        return { turnId: turn.id }
      },
      interruptTurn: async (commandId, threadId) => {
        const thread = readThread(threadId)
        if (!thread?.currentTurnId) {
          recordReceipt(commandId, "completed", { interrupted: false })
          await receiptBus.resolve(commandId, { interrupted: false })
          return { interrupted: false }
        }

        const activeTurnId = thread.currentTurnId

        const optimisticNow = new Date().toISOString()
        database.transaction(() => {
          database.execute(
            `UPDATE orchestration_turns
             SET status = 'interrupting', updated_at = ?
             WHERE id = ? AND status IN ('streaming', 'queued')`,
            [optimisticNow, activeTurnId],
          )
          database.execute(
            `UPDATE orchestration_threads
             SET status = 'interrupting', updated_at = ?
             WHERE id = ? AND status IN ('streaming', 'queued')`,
            [optimisticNow, threadId],
          )
        })

        const optimisticTurn = readTurn(activeTurnId)
        if (optimisticTurn?.status === "interrupting") {
          appendEvent(
            "provider.interruptionRequested",
            { threadId, turnId: activeTurnId },
            { threadId, turnId: activeTurnId, commandId },
          )
          await publishRuntimeEvent({
            type: "provider.interruptionRequested",
            threadId: threadId as ProviderThreadId,
            turnId: activeTurnId as ProviderTurnId,
          })
          await publishDomainEvent({ type: "turn.updated", turn: optimisticTurn })
        }

        const interruptResult = await threadRuntimeManager.interruptTurn(
          threadId,
          activeTurnId,
        )
        if (interruptResult.disposition === "queued" || interruptResult.disposition === "missing") {
          await runtimeStore.dequeueTurn(activeTurnId)
          const persistedTurn = readTurn(activeTurnId)
          await completeTurn(
            commandId,
            threadId,
            activeTurnId,
            persistedTurn?.output ?? "",
            true,
          )
          return { interrupted: true }
        }
        if (!interruptResult.interrupted) {
          const persistedTurn = readTurn(activeTurnId)
          await completeTurn(
            commandId,
            threadId,
            activeTurnId,
            persistedTurn?.output ?? "",
            true,
          )
          return { interrupted: true }
        }

        recordReceipt(commandId, "completed", { interrupted: true, turnId: activeTurnId })
        await receiptBus.resolve(commandId, { interrupted: true, turnId: activeTurnId })
        return { interrupted: true }
      },
      startProviderAuth: async (commandId) => {
        const started = await codexCli.startAuth()
        recordReceipt(commandId, started ? "completed" : "failed", { started })
        await receiptBus.resolve(commandId, { started })
        return { started }
      },
      retryProviderInitialize: async (commandId) => {
        const started = await codexCli.retryInitialize()
        recordReceipt(commandId, started ? "completed" : "failed", { started })
        await receiptBus.resolve(commandId, { started })
        return { started }
      },
      respondToProviderApproval: async (commandId, approvalRequestId, decision) => {
        const result = await threadRuntimeManager.respondToApproval(approvalRequestId, decision)
        if (result.resolved) {
          await publishRuntimeEvent({
            type: "provider.approvalResolved",
            approvalRequestId: result.approvalRequestId,
            threadId: result.threadId as never,
            turnId: result.turnId as never,
            decision: result.decision,
          })
        }
        recordReceipt(commandId, result.resolved ? "completed" : "failed", {
          approvalRequestId,
          resolved: result.resolved,
        })
        await receiptBus.resolve(commandId, {
          approvalRequestId,
          resolved: result.resolved,
        })
        return { approvalRequestId, resolved: result.resolved }
      },
      shutdown: async () => {
        const snapshot = threadRuntimeManager.getSnapshot()
        for (const queued of snapshot.queuedTurns) {
          await runtimeStore.dequeueTurn(queued.turnId)
          const persistedTurn = readTurn(queued.turnId)
          await completeTurn(
            `shutdown_${queued.turnId}`,
            queued.threadId,
            queued.turnId,
            persistedTurn?.output ?? "",
            true,
          )
        }
        for (const active of snapshot.activeTurns) {
          const persistedTurn = readTurn(active.turnId)
          await completeTurn(
            `shutdown_${active.turnId}`,
            active.threadId,
            active.turnId,
            persistedTurn?.output ?? "",
            true,
          )
        }
        await threadRuntimeManager.shutdown()
      },
    }
  }),
)
