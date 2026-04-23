import { existsSync, statSync } from "node:fs"
import path from "node:path"
import {
  type ChatModel,
  type FeatureFlags,
  PUSH_CHANNELS,
  type OrchestrationDomainEvent,
  type OrchestrationThread,
  type OrchestrationTurn,
  type OrchestrationTurnAttachment,
  type OrchestrationWorkspace,
  type ProviderRuntimeEvent,
  type ThreadAccessMode,
  type TurnAttachmentInput,
  type WorkspaceId,
} from "@orbyt/contracts"
import { createId } from "@orbyt/shared-runtime"
import type { AppConfig } from "../config/defaults.js"
import type { DatabaseService } from "../db/Database.js"
import type { ServerReadinessService } from "../runtime/ServerReadiness.js"
import type { PushBusService } from "../ws/PushBus.js"
import type { RuntimeReceiptBusService } from "./RuntimeReceiptBus.js"

// ============================================================================
// Row types
// ============================================================================

export type WorkspaceRow = {
  id: string
  kind: OrchestrationWorkspace["kind"]
  name: string
  root_path: string | null
  availability: Extract<OrchestrationWorkspace, { kind: "filesystem" }>["availability"] | null
  created_at: string
  updated_at: string
}

export type ThreadRow = {
  id: string
  workspace_id: string
  title: string
  access_mode: OrchestrationThread["accessMode"]
  status: OrchestrationThread["status"]
  current_turn_id: string | null
  created_at: string
}

export type TurnRow = {
  id: string
  thread_id: string
  input_text: string
  output_text: string
  reasoning_text: string
  status: OrchestrationTurn["status"]
  started_at: string
  completed_at: string | null
}

export type TurnAttachmentRow = {
  id: string
  turn_id: string
  path: string
  name: string
  mime_type: string | null
  size_bytes: number | null
  kind: OrchestrationTurnAttachment["kind"]
  position: number
}

export type WorkspaceThreadRow = {
  id: string
  current_turn_id: string | null
}

// ============================================================================
// Runtime types shared between stub and live layer
// ============================================================================

export type TurnWorkRef = {
  readonly commandId: string
  readonly threadId: string
  readonly turnId: string
}

export type WorkItem = TurnWorkRef & {
  readonly content: string
  readonly model?: string | null
}

export type ActiveTurnState = {
  readonly interrupted: boolean
}

export type OrchestrationRuntimeState = {
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

// ============================================================================
// Row mappers
// ============================================================================

export function mapWorkspaceRow(row: WorkspaceRow): OrchestrationWorkspace {
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

export function mapThreadRow(row: ThreadRow): OrchestrationThread {
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

export function mapTurnAttachmentRow(row: TurnAttachmentRow): OrchestrationTurnAttachment {
  return {
    id: row.id,
    path: row.path,
    name: row.name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    kind: row.kind,
  }
}

export function mapTurnRow(
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

// ============================================================================
// Attachment DB helpers
// ============================================================================

export function readTurnAttachments(
  database: DatabaseService,
  turnId: string,
): readonly OrchestrationTurnAttachment[] {
  return database
    .query<TurnAttachmentRow>(
      `SELECT id, turn_id, path, name, mime_type, size_bytes, kind, position
       FROM orchestration_turn_attachments
       WHERE turn_id = ?
       ORDER BY position ASC`,
      [turnId],
    )
    .map(mapTurnAttachmentRow)
}

export function readTurnAttachmentsByTurnIds(
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

export function persistTurnAttachments(
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

export function deleteTurnAttachmentsForThreadIds(
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

// ============================================================================
// DB read helpers
// ============================================================================

export function readWorkspaceRow(
  database: DatabaseService,
  workspaceId: string,
): WorkspaceRow | null {
  return database.get<WorkspaceRow>(
    `SELECT id, kind, name, root_path, availability, created_at, updated_at
     FROM chat_workspaces
     WHERE id = ?`,
    [workspaceId],
  )
}

export function readWorkspace(
  database: DatabaseService,
  workspaceId: string,
): OrchestrationWorkspace | null {
  const row = readWorkspaceRow(database, workspaceId)
  return row ? mapWorkspaceRow(row) : null
}

export function readFilesystemWorkspaceByRootPath(
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

export function readThread(
  database: DatabaseService,
  threadId: string,
): OrchestrationThread | null {
  const row = database.get<ThreadRow>(
    `SELECT id, workspace_id, title, access_mode, status, current_turn_id, created_at
     FROM orchestration_threads
     WHERE id = ?`,
    [threadId],
  )
  return row ? mapThreadRow(row) : null
}

export function readTurn(database: DatabaseService, turnId: string): OrchestrationTurn | null {
  const row = database.get<TurnRow>(
    `SELECT id, thread_id, input_text, output_text, reasoning_text, status, started_at, completed_at
     FROM orchestration_turns
     WHERE id = ?`,
    [turnId],
  )
  return row ? mapTurnRow(row, readTurnAttachments(database, turnId)) : null
}

export function readWorkspaceThreadRows(
  database: DatabaseService,
  workspaceId: string,
): readonly WorkspaceThreadRow[] {
  return database.query<WorkspaceThreadRow>(
    `SELECT id, current_turn_id
     FROM orchestration_threads
     WHERE workspace_id = ?`,
    [workspaceId],
  )
}

// ============================================================================
// DB write helpers
// ============================================================================

export function updateWorkspaceAvailability(
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

export function refreshFilesystemWorkspaceAvailability(database: DatabaseService): void {
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

export function resetWorkspaceThreadProviderSessions(
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

export function resetThreadProviderSession(
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

export function reconcileStaleStreamingState(database: DatabaseService): void {
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

// ============================================================================
// Validation and CWD helpers
// ============================================================================

export function assertWorkspaceAcceptsChat(workspace: OrchestrationWorkspace): void {
  if (workspace.kind === "filesystem" && workspace.availability !== "ready") {
    throw new Error(`Workspace is unavailable: ${workspace.name}`)
  }
}

export function readThreadSessionCwd(database: DatabaseService, threadId: string): string | null {
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

export function resolveThreadExecutionCwd(
  database: DatabaseService,
  threadId: string,
): string | null {
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

// ============================================================================
// Event publishing
// ============================================================================

export async function publishDomainEvent(
  pushBus: PushBusService,
  event: OrchestrationDomainEvent,
): Promise<void> {
  await pushBus.publish(PUSH_CHANNELS.ORCHESTRATION_DOMAIN, event)
}

export async function publishRuntimeEvent(
  pushBus: PushBusService,
  event: ProviderRuntimeEvent,
): Promise<void> {
  await pushBus.publish(PUSH_CHANNELS.PROVIDER_RUNTIME, event)
}

// ============================================================================
// Pure utilities
// ============================================================================

export function normalizeRootPath(rawRootPath: string): string {
  const trimmed = rawRootPath.trim()
  if (trimmed.length === 0) {
    throw new Error("Workspace root path is required")
  }

  const normalized = path.normalize(path.resolve(trimmed))
  return process.platform === "win32" ? normalized.toLowerCase() : normalized
}

export function isDirectoryPath(rootPath: string): boolean {
  if (!existsSync(rootPath)) {
    return false
  }

  try {
    return statSync(rootPath).isDirectory()
  } catch {
    return false
  }
}

export function deriveWorkspaceName(rootPath: string): string {
  const name = path.basename(rootPath)
  return name.length > 0 ? name : rootPath
}

export function resolveWorkspaceAvailability(
  rootPath: string,
): Extract<OrchestrationWorkspace, { kind: "filesystem" }>["availability"] {
  return isDirectoryPath(rootPath) ? "ready" : "missing"
}

export function getFeatureFlags(): FeatureFlags {
  return {
    pluginSystem: true,
  }
}

export const BASE_CHAT_MODELS: readonly ChatModel[] = [
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

export function buildChatModels(config: AppConfig): ReadonlyArray<ChatModel> {
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

// ============================================================================
// Domain object builders
// ============================================================================

export function readDefaultAccessModePreference(
  database: DatabaseService,
): ThreadAccessMode {
  const row = database.get<{ default_access_mode: string | null }>(
    "SELECT default_access_mode FROM user_preferences WHERE id = 1",
  )
  return row?.default_access_mode === "full" ? "full" : "default"
}

export function writeDefaultAccessModePreference(
  database: DatabaseService,
  accessMode: ThreadAccessMode,
): void {
  const now = new Date().toISOString()
  database.execute(
    "UPDATE user_preferences SET default_access_mode = ?, updated_at = ? WHERE id = 1",
    [accessMode, now],
  )
}

export function buildThread(
  workspaceId: string,
  title?: string,
  accessMode: ThreadAccessMode = "default",
): OrchestrationThread {
  const now = new Date().toISOString()
  return {
    id: createId("thread") as OrchestrationThread["id"],
    workspaceId: workspaceId as WorkspaceId,
    title: title?.trim() || `Session ${new Date().toLocaleTimeString()}`,
    accessMode,
    status: "idle",
    createdAt: now,
    currentTurnId: null,
  }
}

export function normalizeThreadTitle(title: string): string {
  const normalized = title.trim()
  if (normalized.length === 0) {
    throw new Error("Thread title is required")
  }

  return normalized
}

export function buildFilesystemWorkspace(
  rootPath: string,
): Extract<OrchestrationWorkspace, { kind: "filesystem" }> {
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

export function buildTurnAttachments(
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
