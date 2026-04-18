import { Schema } from "@effect/schema"
import {
  type ActivityFeedEntry,
  CanvasAssignmentDetailsParams,
  CanvasCourseContentOverviewParams,
  CanvasCourseStructureParams,
  CanvasDownloadCourseFileParams,
  CreateWorkspaceParams,
  CreateThreadParams,
  DeleteThreadParams,
  DeleteWorkspaceParams,
  InterruptTurnParams,
  OrchestrationSnapshot,
  PUSH_CHANNELS,
  RenameThreadParams,
  RespondToProviderApprovalParams,
  RetryProviderInitializeParams,
  RPC_METHODS,
  CanvasGetMySubmissionStatusParams,
  CanvasGetMyPeerReviewsTodoParams,
  CanvasGetMyUpcomingAssignmentsParams,
  CanvasListAssignmentsParams,
  RelinkWorkspaceParams,
  RpcErrorResponseEnvelope,
  RpcRequestEnvelope,
  RpcSuccessResponseEnvelope,
  SendTurnParams,
  ServerConfigStreamEvent,
  ServerLifecycleEvent,
  SetThreadAccessModeParams,
  SetAiAuthStatusParams,
  SetStepStatusParams,
  SetOverallStatusParams,
  UpdatePreferencesParams,
  SetRoutinesParams,
} from "@student-claw/contracts"
import type { WebSocket } from "ws"
import type { AppConfig } from "../config/defaults.js"
import { generateWeeklyInsight } from "../activity/feed.js"
import type { OrchestrationServiceShape } from "../orchestration/OrchestrationService.js"
import type { PushBusService } from "./PushBus.js"
import type { ServerReadinessService } from "../runtime/ServerReadiness.js"
import type { DatabaseService } from "../db/Database.js"
import type { CanvasSyncServiceShape } from "../canvas/CanvasSyncService.js"
import type { SkillResolverService } from "../skills/SkillResolver.js"

type RouteDependencies = {
  readonly config: AppConfig
  readonly orchestration: OrchestrationServiceShape
  readonly pushBus: PushBusService
  readonly readiness: ServerReadinessService
  readonly database: DatabaseService
  readonly canvasSync: CanvasSyncServiceShape
  readonly skillResolver: SkillResolverService
}

type RpcRequest = Schema.Schema.Type<typeof RpcRequestEnvelope>

/**
 * Encoded router output plus an optional close instruction for malformed frames.
 */
export type RouteMessageResult = {
  readonly response: string
  readonly close?: {
    readonly code: number
    readonly reason: string
  }
}

function encodeSuccess(id: string, result: unknown): string {
  return JSON.stringify(
    Schema.encodeSync(RpcSuccessResponseEnvelope)({
      kind: "response",
      id,
      ok: true,
      result,
    }),
  )
}

function encodeError(id: string, code: string, message: string): string {
  return JSON.stringify(
    Schema.encodeSync(RpcErrorResponseEnvelope)({
      kind: "response",
      id,
      ok: false,
      error: { code, message },
    }),
  )
}

function closeWithError(
  id: string,
  code: string,
  message: string,
  closeCode: number,
): RouteMessageResult {
  return {
    response: encodeError(id, code, message),
    close: {
      code: closeCode,
      reason: message,
    },
  }
}

function decodeRequest(raw: string): RpcRequest | RouteMessageResult {
  try {
    const parsed = JSON.parse(raw)
    const request = Schema.decodeUnknownEither(RpcRequestEnvelope)(parsed)
    if (request._tag === "Left") {
      return closeWithError(
        "unknown",
        "invalid_request",
        "Request did not match the RPC envelope",
        1007,
      )
    }
    return request.right
  } catch {
    return closeWithError("unknown", "parse_error", "Invalid JSON request", 1007)
  }
}

function decodeParams<A>(
  schema: Schema.Schema<A, any, never>,
  params: unknown,
  id: string,
  message: string,
): A | string {
  const decoded = Schema.decodeUnknownEither(schema)(params)
  return decoded._tag === "Left"
    ? encodeError(id, "invalid_params", message)
    : decoded.right
}

async function handleServerMethod(
  request: RpcRequest,
  ws: WebSocket,
  dependencies: RouteDependencies,
): Promise<string | null> {
  const { id, method } = request

  switch (method) {
    case RPC_METHODS.SERVER_GET_BOOTSTRAP:
      return encodeSuccess(id, await dependencies.orchestration.getDesktopBootstrap())
    case RPC_METHODS.SERVER_GET_CONFIG:
      return encodeSuccess(id, await dependencies.orchestration.getServerConfig())
    case RPC_METHODS.SERVER_SUBSCRIBE_LIFECYCLE:
      return subscribeLifecycle(id, ws, dependencies)
    case RPC_METHODS.SERVER_SUBSCRIBE_CONFIG:
      return subscribeConfig(id, ws, dependencies)
    default:
      return null
  }
}

async function handleStreamMethod(
  request: RpcRequest,
  ws: WebSocket,
  dependencies: RouteDependencies,
): Promise<string | null> {
  switch (request.method) {
    case RPC_METHODS.ACTIVITY_SUBSCRIBE_FEED:
      dependencies.pushBus.subscribe(ws, PUSH_CHANNELS.ACTIVITY_FEED)
      return encodeSuccess(request.id, { subscribed: true })
    case RPC_METHODS.ORCHESTRATION_SUBSCRIBE_DOMAIN:
      dependencies.pushBus.subscribe(ws, PUSH_CHANNELS.ORCHESTRATION_DOMAIN)
      return encodeSuccess(request.id, { subscribed: true })
    case RPC_METHODS.PROVIDER_SUBSCRIBE_RUNTIME:
      dependencies.pushBus.subscribe(ws, PUSH_CHANNELS.PROVIDER_RUNTIME)
      return encodeSuccess(request.id, { subscribed: true })
    case RPC_METHODS.CANVAS_SUBSCRIBE_SYNC_PROGRESS:
      dependencies.pushBus.subscribe(ws, PUSH_CHANNELS.CANVAS_SYNC_PROGRESS)
      return encodeSuccess(request.id, { subscribed: true })
    case RPC_METHODS.DASHBOARD_SUBSCRIBE_UPDATES:
      dependencies.pushBus.subscribe(ws, PUSH_CHANNELS.DASHBOARD_UPDATE)
      return encodeSuccess(request.id, { subscribed: true })
    case RPC_METHODS.PLANNER_SUBSCRIBE_CHECK_INS:
      dependencies.pushBus.subscribe(ws, PUSH_CHANNELS.PLANNER_SESSION_CHECK_IN)
      return encodeSuccess(request.id, { subscribed: true })
    default:
      return null
  }
}

async function handleActivityMethod(
  request: RpcRequest,
  dependencies: RouteDependencies,
): Promise<string | null> {
  const { id, method } = request

  switch (method) {
    case RPC_METHODS.ACTIVITY_GENERATE_WEEKLY_INSIGHT:
      return encodeSuccess(id, await generateWeeklyInsight({
        database: dependencies.database,
        config: dependencies.config,
      }))
    default:
      return null
  }
}

async function handleCanvasMethod(
  request: RpcRequest,
  dependencies: RouteDependencies,
): Promise<string | null> {
  const { id, method, params } = request
  switch (method) {
    case RPC_METHODS.CANVAS_LIST_COURSES:
      return encodeSuccess(id, { courses: dependencies.canvasSync.listCourses() })
    case RPC_METHODS.CANVAS_GET_MY_UPCOMING_ASSIGNMENTS: {
      const decoded = decodeParams(
        CanvasGetMyUpcomingAssignmentsParams,
        params,
        id,
        "Invalid Canvas upcoming-assignment request parameters",
      )
      if (typeof decoded === "string") return decoded
      return encodeSuccess(id, {
        items: dependencies.canvasSync.getMyUpcomingAssignments(decoded.days),
      })
    }
    case RPC_METHODS.CANVAS_GET_MY_SUBMISSION_STATUS: {
      const decoded = decodeParams(
        CanvasGetMySubmissionStatusParams,
        params,
        id,
        "Invalid Canvas submission-status request parameters",
      )
      if (typeof decoded === "string") return decoded
      return encodeSuccess(id, dependencies.canvasSync.getMySubmissionStatus(decoded.courseId))
    }
    case RPC_METHODS.CANVAS_GET_MY_COURSE_GRADES:
      return encodeSuccess(id, { courses: dependencies.canvasSync.getMyCourseGrades() })
    case RPC_METHODS.CANVAS_GET_MY_TODO_ITEMS:
      return encodeSuccess(id, { items: dependencies.canvasSync.getMyTodoItems() })
    case RPC_METHODS.CANVAS_GET_MY_PEER_REVIEWS_TODO: {
      const decoded = decodeParams(
        CanvasGetMyPeerReviewsTodoParams,
        params,
        id,
        "Invalid Canvas peer-review request parameters",
      )
      if (typeof decoded === "string") return decoded
      return encodeSuccess(id, { items: dependencies.canvasSync.getMyPeerReviewsTodo(decoded.courseId) })
    }
    case RPC_METHODS.CANVAS_GET_ASSIGNMENT_DETAILS: {
      const decoded = decodeParams(
        CanvasAssignmentDetailsParams,
        params,
        id,
        "Invalid Canvas assignment-detail request parameters",
      )
      if (typeof decoded === "string") return decoded
      return encodeSuccess(id, await dependencies.canvasSync.getAssignmentDetails(decoded))
    }
    case RPC_METHODS.CANVAS_LIST_ASSIGNMENTS: {
      const decoded = decodeParams(
        CanvasListAssignmentsParams,
        params,
        id,
        "Invalid Canvas assignment-list request parameters",
      )
      if (typeof decoded === "string") return decoded
      return encodeSuccess(id, await dependencies.canvasSync.listAssignments(decoded))
    }
    case RPC_METHODS.CANVAS_GET_COURSE_CONTENT_OVERVIEW: {
      const decoded = decodeParams(
        CanvasCourseContentOverviewParams,
        params,
        id,
        "Invalid Canvas content-overview request parameters",
      )
      if (typeof decoded === "string") return decoded
      return encodeSuccess(id, await dependencies.canvasSync.getCourseContentOverview(decoded))
    }
    case RPC_METHODS.CANVAS_GET_COURSE_STRUCTURE: {
      const decoded = decodeParams(
        CanvasCourseStructureParams,
        params,
        id,
        "Invalid Canvas course-structure request parameters",
      )
      if (typeof decoded === "string") return decoded
      return encodeSuccess(id, await dependencies.canvasSync.getCourseStructure(decoded))
    }
    case RPC_METHODS.CANVAS_DOWNLOAD_COURSE_FILE: {
      const decoded = decodeParams(
        CanvasDownloadCourseFileParams,
        params,
        id,
        "Invalid Canvas file-download request parameters",
      )
      if (typeof decoded === "string") return decoded
      return encodeSuccess(id, await dependencies.canvasSync.downloadCourseFile(decoded))
    }
    case RPC_METHODS.CANVAS_SYNC:
      void dependencies.canvasSync.sync()
      return encodeSuccess(id, { queued: true })
    default:
      return null
  }
}

async function handleDashboardMethod(
  request: RpcRequest,
  dependencies: RouteDependencies,
): Promise<string | null> {
  const { id, method } = request
  switch (method) {
    case RPC_METHODS.DASHBOARD_REFRESH:
      void dependencies.pushBus.publish(PUSH_CHANNELS.DASHBOARD_UPDATE, {
        section: "all",
      })
      return encodeSuccess(id, { refreshed: true })
    default:
      return null
  }
}

async function handleOrchestrationMethod(
  request: RpcRequest,
  dependencies: RouteDependencies,
): Promise<string | null> {
  const { id, method, params } = request

  switch (method) {
    case RPC_METHODS.ORCHESTRATION_GET_SNAPSHOT:
      return encodeSuccess(
        id,
        Schema.encodeSync(OrchestrationSnapshot)(await dependencies.orchestration.getSnapshot()),
      )
    case RPC_METHODS.ORCHESTRATION_CREATE_WORKSPACE:
      return handleCreateWorkspace(id, params, dependencies)
    case RPC_METHODS.ORCHESTRATION_RELINK_WORKSPACE:
      return handleRelinkWorkspace(id, params, dependencies)
    case RPC_METHODS.ORCHESTRATION_DELETE_WORKSPACE:
      return handleDeleteWorkspace(id, params, dependencies)
    case RPC_METHODS.ORCHESTRATION_CREATE_THREAD:
      return handleCreateThread(id, params, dependencies)
    case RPC_METHODS.ORCHESTRATION_RENAME_THREAD:
      return handleRenameThread(id, params, dependencies)
    case RPC_METHODS.ORCHESTRATION_SET_THREAD_ACCESS_MODE:
      return handleSetThreadAccessMode(id, params, dependencies)
    case RPC_METHODS.ORCHESTRATION_DELETE_THREAD:
      return handleDeleteThread(id, params, dependencies)
    case RPC_METHODS.ORCHESTRATION_SEND_TURN:
      return handleSendTurn(id, params, dependencies)
    case RPC_METHODS.ORCHESTRATION_INTERRUPT_TURN:
      return handleInterruptTurn(id, params, dependencies)
    default:
      return null
  }
}

async function handleCreateWorkspace(
  id: string,
  params: unknown,
  dependencies: RouteDependencies,
): Promise<string> {
  const decoded = decodeParams(
    CreateWorkspaceParams,
    params,
    id,
    "createWorkspace params are invalid",
  )
  if (typeof decoded === "string") {
    return decoded
  }

  return encodeSuccess(id, await dependencies.orchestration.createWorkspace(id, decoded.rootPath))
}

async function handleRelinkWorkspace(
  id: string,
  params: unknown,
  dependencies: RouteDependencies,
): Promise<string> {
  const decoded = decodeParams(
    RelinkWorkspaceParams,
    params,
    id,
    "relinkWorkspace params are invalid",
  )
  if (typeof decoded === "string") {
    return decoded
  }

  return encodeSuccess(
    id,
    await dependencies.orchestration.relinkWorkspace(id, decoded.workspaceId, decoded.rootPath),
  )
}

async function handleDeleteWorkspace(
  id: string,
  params: unknown,
  dependencies: RouteDependencies,
): Promise<string> {
  const decoded = decodeParams(
    DeleteWorkspaceParams,
    params,
    id,
    "deleteWorkspace params are invalid",
  )
  if (typeof decoded === "string") {
    return decoded
  }

  return encodeSuccess(id, await dependencies.orchestration.deleteWorkspace(id, decoded.workspaceId))
}

async function handleCreateThread(
  id: string,
  params: unknown,
  dependencies: RouteDependencies,
): Promise<string> {
  const decoded = decodeParams(CreateThreadParams, params, id, "createThread params are invalid")
  if (typeof decoded === "string") {
    return decoded
  }

  return encodeSuccess(
    id,
    await dependencies.orchestration.createThread(id, decoded.workspaceId, decoded.title),
  )
}

async function handleRenameThread(
  id: string,
  params: unknown,
  dependencies: RouteDependencies,
): Promise<string> {
  const decoded = decodeParams(RenameThreadParams, params, id, "renameThread params are invalid")
  if (typeof decoded === "string") {
    return decoded
  }

  return encodeSuccess(
    id,
    await dependencies.orchestration.renameThread(id, decoded.threadId, decoded.title),
  )
}

async function handleDeleteThread(
  id: string,
  params: unknown,
  dependencies: RouteDependencies,
): Promise<string> {
  const decoded = decodeParams(DeleteThreadParams, params, id, "deleteThread params are invalid")
  if (typeof decoded === "string") {
    return decoded
  }

  return encodeSuccess(
    id,
    await dependencies.orchestration.deleteThread(id, decoded.threadId),
  )
}

async function handleSetThreadAccessMode(
  id: string,
  params: unknown,
  dependencies: RouteDependencies,
): Promise<string> {
  const decoded = decodeParams(
    SetThreadAccessModeParams,
    params,
    id,
    "setThreadAccessMode params are invalid",
  )
  if (typeof decoded === "string") {
    return decoded
  }

  return encodeSuccess(
    id,
    await dependencies.orchestration.setThreadAccessMode(id, decoded.threadId, decoded.accessMode),
  )
}

async function handleSendTurn(
  id: string,
  params: unknown,
  dependencies: RouteDependencies,
): Promise<string> {
  const decoded = decodeParams(SendTurnParams, params, id, "sendTurn params are invalid")
  if (typeof decoded === "string") {
    return decoded
  }

  const skill = decoded.skillId ? dependencies.skillResolver.resolve(decoded.skillId) : null
  const effectiveContent = skill
    ? `${skill.instructions}\n\n${decoded.content}`.trim()
    : decoded.content

  return encodeSuccess(
    id,
    await dependencies.orchestration.sendTurn(
      id,
      decoded.threadId,
      effectiveContent,
      decoded.attachments,
      decoded.model ?? null,
    ),
  )
}

async function handleListSkills(
  id: string,
  dependencies: RouteDependencies,
): Promise<string> {
  const skills = dependencies.skillResolver.listAll().map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
  }))
  return encodeSuccess(id, { skills })
}

async function handleInterruptTurn(
  id: string,
  params: unknown,
  dependencies: RouteDependencies,
): Promise<string> {
  const decoded = decodeParams(InterruptTurnParams, params, id, "interruptTurn params are invalid")
  if (typeof decoded === "string") {
    return decoded
  }

  return encodeSuccess(id, await dependencies.orchestration.interruptTurn(id, decoded.threadId))
}

async function subscribeLifecycle(
  id: string,
  ws: WebSocket,
  dependencies: RouteDependencies,
): Promise<string> {
  dependencies.pushBus.subscribe(ws, PUSH_CHANNELS.SERVER_LIFECYCLE)
  if (dependencies.readiness.isReady()) {
    const bootstrap = await dependencies.orchestration.getDesktopBootstrap()
    await dependencies.pushBus.publishTo(
      ws,
      PUSH_CHANNELS.SERVER_LIFECYCLE,
      Schema.encodeSync(ServerLifecycleEvent)({
        type: "welcome",
        payload: {
          bootstrap,
          connectedAt: new Date().toISOString(),
        },
      }),
    )
  }
  return encodeSuccess(id, { subscribed: true })
}

async function subscribeConfig(
  id: string,
  ws: WebSocket,
  dependencies: RouteDependencies,
): Promise<string> {
  dependencies.pushBus.subscribe(ws, PUSH_CHANNELS.SERVER_CONFIG)
  const config = await dependencies.orchestration.getServerConfig()
  await dependencies.pushBus.publishTo(
    ws,
    PUSH_CHANNELS.SERVER_CONFIG,
    Schema.encodeSync(ServerConfigStreamEvent)({
      type: "snapshot",
      config,
    }),
  )
  return encodeSuccess(id, { subscribed: true })
}

async function handleProviderMethod(
  request: RpcRequest,
  dependencies: RouteDependencies,
): Promise<string | null> {
  const { id, method, params } = request

  switch (method) {
    case RPC_METHODS.PROVIDER_START_AUTH:
      return encodeSuccess(id, await dependencies.orchestration.startProviderAuth(id))
    case RPC_METHODS.PROVIDER_RETRY_INITIALIZE:
      return encodeSuccess(id, await dependencies.orchestration.retryProviderInitialize(id))
    case RPC_METHODS.PROVIDER_RESPOND_TO_APPROVAL: {
      const decoded = decodeParams(
        RespondToProviderApprovalParams,
        params,
        id,
        "respondToApproval params are invalid",
      )
      if (typeof decoded === "string") {
        return decoded
      }
      return encodeSuccess(
        id,
        await dependencies.orchestration.respondToProviderApproval(
          id,
          decoded.approvalRequestId,
          decoded.decision,
        ),
      )
    }
    default:
      return null
  }
}

async function handleOnboardingMethod(
  request: RpcRequest,
  dependencies: RouteDependencies,
): Promise<string | null> {
  const { id, method, params } = request
  const { database } = dependencies

  switch (method) {
    case RPC_METHODS.ONBOARDING_GET_AI_AUTH: {
      const row = database.get<{ status: string; provider: string | null; connected_at: string | null }>(
        "SELECT status, provider, connected_at FROM ai_auth_state WHERE id = 1",
      )
      return encodeSuccess(id, {
        status: row?.status ?? "pending",
        provider: row?.provider ?? null,
        connectedAt: row?.connected_at ?? null,
      })
    }
    case RPC_METHODS.ONBOARDING_SET_AI_AUTH: {
      const decoded = decodeParams(SetAiAuthStatusParams, params, id, "setAiAuth params are invalid")
      if (typeof decoded === "string") return decoded
      const now = new Date().toISOString()
      database.execute(
        `UPDATE ai_auth_state
         SET status = ?, provider = ?, connected_at = ?, updated_at = ?
         WHERE id = 1`,
        [decoded.status, decoded.provider ?? null, decoded.status === "connected" ? now : null, now],
      )
      const row = database.get<{ status: string; provider: string | null; connected_at: string | null }>(
        "SELECT status, provider, connected_at FROM ai_auth_state WHERE id = 1",
      )
      return encodeSuccess(id, {
        status: row?.status ?? "pending",
        provider: row?.provider ?? null,
        connectedAt: row?.connected_at ?? null,
      })
    }
    case RPC_METHODS.ONBOARDING_GET_SNAPSHOT: {
      const steps = database.query<{ step_name: string; status: string; completed_at: string | null }>(
        "SELECT step_name, status, completed_at FROM onboarding_state",
      )
      const meta = database.get<{ value: string }>(
        "SELECT value FROM onboarding_meta WHERE key = 'overall_status'",
      )
      return encodeSuccess(id, {
        steps: steps.map((s) => ({ stepName: s.step_name, status: s.status, completedAt: s.completed_at })),
        overallStatus: meta?.value ?? "in_progress",
      })
    }
    case RPC_METHODS.ONBOARDING_SET_STEP_STATUS: {
      const decoded = decodeParams(SetStepStatusParams, params, id, "setStepStatus params are invalid")
      if (typeof decoded === "string") return decoded
      database.execute(
        `INSERT INTO onboarding_state (step_name, status, completed_at)
         VALUES (?, ?, ?)
         ON CONFLICT(step_name) DO UPDATE SET status = excluded.status, completed_at = excluded.completed_at`,
        [decoded.stepName, decoded.status, decoded.status === "completed" ? new Date().toISOString() : null],
      )
      return encodeSuccess(id, { ok: true })
    }
    case RPC_METHODS.ONBOARDING_SET_OVERALL_STATUS: {
      const decoded = decodeParams(SetOverallStatusParams, params, id, "setOverallStatus params are invalid")
      if (typeof decoded === "string") return decoded
      database.execute(
        `INSERT INTO onboarding_meta (key, value, updated_at) VALUES ('overall_status', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [decoded.status, new Date().toISOString()],
      )
      return encodeSuccess(id, { ok: true })
    }
    case RPC_METHODS.ONBOARDING_GET_PREFERENCES: {
      // Ensure a default row exists, then return it.
      database.execute(
        `INSERT OR IGNORE INTO user_preferences
           (id, study_times, course_ranking, max_session_mins, off_limit_days,
            notification_enabled, quiet_hours_start, quiet_hours_end, calendar_integration)
         VALUES (1, '[]', '[]', 90, '[]', 1, '22:00', '08:00', 'none')`,
      )
      const row = database.get<{
        study_times: string
        course_ranking: string
        max_session_mins: number
        off_limit_days: string
        notification_enabled: number
        quiet_hours_start: string
        quiet_hours_end: string
        calendar_integration: string
      }>("SELECT * FROM user_preferences WHERE id = 1")
      if (!row) return encodeError(id, "internal_error", "Could not read preferences")
      return encodeSuccess(id, {
        studyTimes: JSON.parse(row.study_times) as string[],
        courseRanking: JSON.parse(row.course_ranking) as string[],
        maxSessionMins: row.max_session_mins,
        offLimitDays: JSON.parse(row.off_limit_days) as number[],
        notificationEnabled: row.notification_enabled === 1,
        quietHoursStart: row.quiet_hours_start,
        quietHoursEnd: row.quiet_hours_end,
        calendarIntegration: row.calendar_integration,
      })
    }
    case RPC_METHODS.ONBOARDING_SET_PREFERENCES: {
      const decoded = decodeParams(UpdatePreferencesParams, params, id, "setPreferences params are invalid")
      if (typeof decoded === "string") return decoded
      // Ensure default row exists before merging.
      database.execute(
        `INSERT OR IGNORE INTO user_preferences
           (id, study_times, course_ranking, max_session_mins, off_limit_days,
            notification_enabled, quiet_hours_start, quiet_hours_end, calendar_integration)
         VALUES (1, '[]', '[]', 90, '[]', 1, '22:00', '08:00', 'none')`,
      )
      const now = new Date().toISOString()
      if (decoded.studyTimes !== undefined) {
        database.execute(
          "UPDATE user_preferences SET study_times = ?, updated_at = ? WHERE id = 1",
          [JSON.stringify(decoded.studyTimes), now],
        )
      }
      if (decoded.courseRanking !== undefined) {
        database.execute(
          "UPDATE user_preferences SET course_ranking = ?, updated_at = ? WHERE id = 1",
          [JSON.stringify(decoded.courseRanking), now],
        )
      }
      if (decoded.maxSessionMins !== undefined) {
        database.execute(
          "UPDATE user_preferences SET max_session_mins = ?, updated_at = ? WHERE id = 1",
          [decoded.maxSessionMins, now],
        )
      }
      if (decoded.offLimitDays !== undefined) {
        database.execute(
          "UPDATE user_preferences SET off_limit_days = ?, updated_at = ? WHERE id = 1",
          [JSON.stringify(decoded.offLimitDays), now],
        )
      }
      if (decoded.notificationEnabled !== undefined) {
        database.execute(
          "UPDATE user_preferences SET notification_enabled = ?, updated_at = ? WHERE id = 1",
          [decoded.notificationEnabled ? 1 : 0, now],
        )
      }
      if (decoded.quietHoursStart !== undefined) {
        database.execute(
          "UPDATE user_preferences SET quiet_hours_start = ?, updated_at = ? WHERE id = 1",
          [decoded.quietHoursStart, now],
        )
      }
      if (decoded.quietHoursEnd !== undefined) {
        database.execute(
          "UPDATE user_preferences SET quiet_hours_end = ?, updated_at = ? WHERE id = 1",
          [decoded.quietHoursEnd, now],
        )
      }
      if (decoded.calendarIntegration !== undefined) {
        database.execute(
          "UPDATE user_preferences SET calendar_integration = ?, updated_at = ? WHERE id = 1",
          [decoded.calendarIntegration, now],
        )
      }
      const row = database.get<{
        study_times: string
        course_ranking: string
        max_session_mins: number
        off_limit_days: string
        notification_enabled: number
        quiet_hours_start: string
        quiet_hours_end: string
        calendar_integration: string
      }>("SELECT * FROM user_preferences WHERE id = 1")
      if (!row) return encodeError(id, "internal_error", "Could not read updated preferences")
      return encodeSuccess(id, {
        studyTimes: JSON.parse(row.study_times) as string[],
        courseRanking: JSON.parse(row.course_ranking) as string[],
        maxSessionMins: row.max_session_mins,
        offLimitDays: JSON.parse(row.off_limit_days) as number[],
        notificationEnabled: row.notification_enabled === 1,
        quietHoursStart: row.quiet_hours_start,
        quietHoursEnd: row.quiet_hours_end,
        calendarIntegration: row.calendar_integration,
      })
    }
    case RPC_METHODS.ONBOARDING_GET_ROUTINES: {
      const cells = database.query<{ day_of_week: number; hour_of_day: number }>(
        "SELECT day_of_week, hour_of_day FROM routines ORDER BY day_of_week, hour_of_day",
      ).map((r) => ({ dayOfWeek: r.day_of_week, hourOfDay: r.hour_of_day }))
      return encodeSuccess(id, { cells })
    }
    case RPC_METHODS.ONBOARDING_SET_ROUTINES: {
      const decoded = decodeParams(SetRoutinesParams, params, id, "setRoutines params are invalid")
      if (typeof decoded === "string") return decoded
      database.transaction(() => {
        database.execute("DELETE FROM routines")
        for (const cell of decoded.cells) {
          database.execute(
            "INSERT OR IGNORE INTO routines (day_of_week, hour_of_day) VALUES (?, ?)",
            [cell.dayOfWeek, cell.hourOfDay],
          )
        }
      })
      return encodeSuccess(id, { count: decoded.cells.length })
    }
    default:
      return null
  }
}

/**
 * Routes a single RPC frame, validating envelopes and params before invoking server handlers.
 */
async function handleSkillsMethod(
  request: RpcRequest,
  dependencies: RouteDependencies,
): Promise<string | null> {
  const { id, method } = request

  switch (method) {
    case RPC_METHODS.SKILLS_LIST:
      return handleListSkills(id, dependencies)
    default:
      return null
  }
}

export async function routeMessage(
  raw: string,
  ws: WebSocket,
  dependencies: RouteDependencies,
): Promise<RouteMessageResult> {
  const decoded = decodeRequest(raw)
  if ("response" in decoded) {
    return decoded
  }

  try {
    const response = await handleServerMethod(decoded, ws, dependencies)
      ?? await handleStreamMethod(decoded, ws, dependencies)
      ?? await handleActivityMethod(decoded, dependencies)
      ?? await handleCanvasMethod(decoded, dependencies)
      ?? await handleDashboardMethod(decoded, dependencies)
      ?? await handleOrchestrationMethod(decoded, dependencies)
      ?? await handleProviderMethod(decoded, dependencies)
      ?? await handleOnboardingMethod(decoded, dependencies)
      ?? await handleSkillsMethod(decoded, dependencies)

    if (response) {
      return { response }
    }

    return {
      response: encodeError(
        decoded.id,
        "method_not_found",
        `Method not implemented: ${decoded.method}`,
      ),
    }
  } catch (error) {
    return {
      response: encodeError(
        decoded.id,
        "internal_error",
        error instanceof Error ? error.message : "Unknown routing error",
      ),
    }
  }
}
