import { Effect, Layer } from "effect"
import {
  PUSH_CHANNELS,
  type OrchestrationDomainEvent,
  type OrchestrationThread,
  type OrchestrationTurn,
  type ProviderRuntimeEvent,
} from "@student-claw/contracts"
import { createId } from "@student-claw/shared-runtime"
import { CodexCli, ProviderRuntimeFailure } from "../ai/CodexCli.js"
import { ProviderRuntimeStore } from "../ai/ProviderRuntimeStore.js"
import { ConfigService } from "../config/ConfigService.js"
import { Database } from "../db/Database.js"
import { ServerReadiness } from "../runtime/ServerReadiness.js"
import { PushBus } from "../ws/PushBus.js"
import { RuntimeReceiptBus } from "./RuntimeReceiptBus.js"
import {
  type ThreadRow,
  type TurnAttachmentRow,
  type TurnRow,
  type WorkItem,
  type WorkspaceRow,
  assertWorkspaceAcceptsChat,
  buildChatModels,
  buildFilesystemWorkspace,
  buildThread,
  buildTurnAttachments,
  deleteTurnAttachmentsForThreadIds,
  deriveWorkspaceName,
  getFeatureFlags,
  isDirectoryPath,
  mapThreadRow,
  mapTurnAttachmentRow,
  mapTurnRow,
  mapWorkspaceRow,
  normalizeRootPath,
  normalizeThreadTitle,
  persistTurnAttachments,
  readFilesystemWorkspaceByRootPath,
  readTurnAttachmentsByTurnIds,
  readWorkspace,
  readWorkspaceThreadRows,
  reconcileStaleStreamingState,
  refreshFilesystemWorkspaceAvailability,
  resetThreadProviderSession,
  resetWorkspaceThreadProviderSessions,
  resolveThreadExecutionCwd,
  updateWorkspaceAvailability,
} from "./OrchestrationDB.js"
import { OrchestrationService } from "./OrchestrationService.js"

type ProviderThreadScopedEvent = Extract<
  ProviderRuntimeEvent,
  { readonly threadId: unknown; readonly turnId: unknown }
>
type ProviderThreadId = ProviderThreadScopedEvent["threadId"]
type ProviderTurnId = ProviderThreadScopedEvent["turnId"]

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
      return mapThreadRow(row)
    }

    const readTurn = (turnId: string): OrchestrationTurn | null => {
      const rows = database.query<TurnAttachmentRow>(
        `SELECT id, turn_id, path, name, mime_type, size_bytes, kind, position
         FROM orchestration_turn_attachments
         WHERE turn_id = ?
         ORDER BY position ASC`,
        [turnId],
      )
      const attachments = rows.map(mapTurnAttachmentRow)
      const row = database.get<TurnRow>(
        `SELECT id, thread_id, input_text, output_text, reasoning_text, status, started_at, completed_at
         FROM orchestration_turns
         WHERE id = ?`,
        [turnId],
      )
      return row ? mapTurnRow(row, attachments) : null
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
          threadId: threadId as ProviderThreadId,
          turnId: turnId as ProviderTurnId,
        })
        await publishDomainEvent({ type: "turn.interrupted", turn })
      } else {
        appendEvent("turn.completed", { turn }, { threadId, turnId, commandId })
        recordReceipt(commandId, "completed", { turnId, threadId })
        await publishRuntimeEvent({
          type: "provider.turnCompleted",
          threadId: threadId as ProviderThreadId,
          turnId: turnId as ProviderTurnId,
          output,
        })
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

      const turn = readTurn(work.turnId)
      if (turn) {
        appendEvent("turn.started", { turn }, {
          threadId: work.threadId,
          turnId: work.turnId,
          commandId: work.commandId,
        })
        await publishDomainEvent({ type: "turn.started", turn })
      }
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
          threadId: work.threadId as ProviderThreadId,
          turnId: work.turnId as ProviderTurnId,
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
                await completeTurn(
                  work.commandId,
                  work.threadId,
                  work.turnId,
                  readTurn(work.turnId)?.output ?? "",
                  true,
                )
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
              threadId: work.threadId as ProviderThreadId,
              turnId: work.turnId as ProviderTurnId,
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
              threadId: work.threadId as ProviderThreadId,
              turnId: work.turnId as ProviderTurnId,
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
    void runtimeStore.listQueuedTurns().then((persistedQueuedTurns) => {
      workQueue.push(
        ...persistedQueuedTurns.map((entry) => ({
          commandId: `queued_${entry.turnId}`,
          threadId: entry.threadId,
          turnId: entry.turnId,
          content: entry.content,
        })),
      )
      void runtimeStore.refreshQueuedCount()
      void codexCli
        .initialize()
        .then(() => {
          void drainQueue()
        })
        .catch(() => undefined)
    })

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

        const workspaces = database
          .query<WorkspaceRow>(
            `SELECT id, kind, name, root_path, availability, created_at, updated_at
             FROM chat_workspaces
             ORDER BY created_at ASC`,
          )
          .map(mapWorkspaceRow)
        const threads = database
          .query<ThreadRow>(
            `SELECT id, workspace_id, title, access_mode, status, current_turn_id, created_at
             FROM orchestration_threads
             ORDER BY created_at ASC`,
          )
          .map(mapThreadRow)
        const turnRows = database.query<TurnRow>(
          `SELECT id, thread_id, input_text, output_text, reasoning_text, status, started_at, completed_at
           FROM orchestration_turns
           ORDER BY started_at ASC`,
        )
        const attachmentsByTurnId = readTurnAttachmentsByTurnIds(
          database,
          turnRows.map((row) => row.id),
        )
        const turns = turnRows.map((row) =>
          mapTurnRow(row, attachmentsByTurnId.get(row.id) ?? []),
        )
        const providerRuntime = await runtimeStore.getState()
        return {
          workspaces,
          threads,
          turns,
          pendingApprovals: codexCli.listPendingApprovals(),
          providerStatus: providerRuntime.status,
          providerRuntime,
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

        const now = new Date().toISOString()
        database.execute(
          `UPDATE chat_workspaces
           SET name = ?, root_path = ?, availability = ?, updated_at = ?
           WHERE id = ?`,
          [deriveWorkspaceName(normalized), normalized, "ready", now, workspaceId],
        )
        resetWorkspaceThreadProviderSessions(database, workspaceId, normalized, now)

        const updatedWorkspace = readWorkspace(database, workspaceId)
        if (!updatedWorkspace) {
          throw new Error(`Workspace not found after relink: ${workspaceId}`)
        }

        appendEvent("workspace.updated", { workspace: updatedWorkspace }, { commandId })
        recordReceipt(commandId, "completed", { workspaceId: updatedWorkspace.id })
        await publishDomainEvent({
          type: "workspace.updated",
          workspace: updatedWorkspace,
        })
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
        const deletedThreadIdSet = new Set(threadRows.map((row) => row.id))
        const activeTurnIds = threadRows.flatMap((row) =>
          row.current_turn_id ? [row.current_turn_id] : [],
        )

        for (const turnId of activeTurnIds) {
          activeTurns.delete(turnId)
        }

        const remainingQueue = workQueue.filter(
          (item) => !deletedThreadIdSet.has(item.threadId),
        )
        workQueue.splice(0, workQueue.length, ...remainingQueue)

        database.transaction(() => {
          if (deletedThreadIds.length > 0) {
            const placeholders = deletedThreadIds.map(() => "?").join(", ")
            deleteTurnAttachmentsForThreadIds(database, deletedThreadIds)
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
        recordReceipt(commandId, "completed", {
          deleted: true,
          workspaceId,
          deletedThreadIds,
        })
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
        recordReceipt(commandId, "completed", {
          threadId,
          workspaceId: updatedThread.workspaceId,
        })
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

        if (thread.currentTurnId) {
          activeTurns.delete(thread.currentTurnId)
        }

        const remainingQueue = workQueue.filter((item) => item.threadId !== threadId)
        workQueue.splice(0, workQueue.length, ...remainingQueue)

        database.transaction(() => {
          deleteTurnAttachmentsForThreadIds(database, [threadId])
          database.execute(
            `DELETE FROM orchestration_turns WHERE thread_id = ?`,
            [threadId],
          )
          database.execute(
            `DELETE FROM provider_runtime_sessions WHERE thread_id = ?`,
            [threadId],
          )
          database.execute(
            `DELETE FROM orchestration_threads WHERE id = ?`,
            [threadId],
          )
        })

        appendEvent(
          "thread.deleted",
          { threadId, workspaceId: thread.workspaceId },
          { threadId, commandId },
        )
        recordReceipt(commandId, "completed", {
          deleted: true,
          threadId,
          workspaceId: thread.workspaceId,
        })
        await publishDomainEvent({
          type: "thread.deleted",
          threadId: thread.id,
          workspaceId: thread.workspaceId,
        })
        await receiptBus.resolve(commandId, { deleted: true, threadId })
        return { deleted: true }
      },
      sendTurn: async (commandId, threadId, content, attachments, model) => {
        const thread = readThread(threadId)
        if (!thread) {
          throw new Error(`Thread not found: ${threadId}`)
        }

        const runtimeState = await runtimeStore.getState()
        if (
          runtimeState.authState === "auth_required"
          || runtimeState.status === "auth_required"
        ) {
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
            [
              turn.id,
              turn.threadId,
              turn.input,
              turn.output,
              turn.status,
              turn.startedAt,
              turn.completedAt,
              now,
            ],
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

        activeTurns.set(turn.id, { interrupted: false })
        await runtimeStore.enqueueTurn(turn.id, threadId, content)
        await runtimeStore.upsertThreadSession(threadId, {
          status: runtimeState.status,
          authState: runtimeState.authState,
        })

        appendEvent("turn.queued", { turn }, { threadId, turnId: turn.id, commandId })
        await publishDomainEvent({ type: "turn.queued", turn })
        workQueue.push({ commandId, threadId, turnId: turn.id, content, model })
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
        await codexCli.interruptTurn(threadId, thread.currentTurnId).catch(() => false)
        recordReceipt(commandId, "completed", {
          interrupted: true,
          turnId: thread.currentTurnId,
        })
        await receiptBus.resolve(commandId, {
          interrupted: true,
          turnId: thread.currentTurnId,
        })
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
        if (started) {
          void drainQueue()
        }
        recordReceipt(commandId, started ? "completed" : "failed", { started })
        await receiptBus.resolve(commandId, { started })
        return { started }
      },
      respondToProviderApproval: async (commandId, approvalRequestId, decision) => {
        const result = await codexCli.respondToApproval(approvalRequestId, decision)
        if (result.resolved) {
          await publishRuntimeEvent({
            type: "provider.approvalResolved",
            approvalRequestId: result.approvalRequestId,
            threadId: result.threadId as ProviderThreadId,
            turnId: result.turnId as ProviderTurnId,
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
        await codexCli.shutdown()
      },
    }
  }),
)
