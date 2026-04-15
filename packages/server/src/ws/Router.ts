import { Schema } from "@effect/schema"
import {
  CreateWorkspaceParams,
  CreateThreadParams,
  DeleteThreadParams,
  DeleteWorkspaceParams,
  InterruptTurnParams,
  OrchestrationSnapshot,
  PUSH_CHANNELS,
  RenameThreadParams,
  RetryProviderInitializeParams,
  RPC_METHODS,
  RelinkWorkspaceParams,
  RpcErrorResponseEnvelope,
  RpcRequestEnvelope,
  RpcSuccessResponseEnvelope,
  SendTurnParams,
  ServerConfigStreamEvent,
  ServerLifecycleEvent,
  SetAiAuthStatusParams,
  SetStepStatusParams,
  SetOverallStatusParams,
} from "@student-claw/contracts"
import type { WebSocket } from "ws"
import type { OrchestrationServiceShape } from "../orchestration/OrchestrationService.js"
import type { PushBusService } from "./PushBus.js"
import type { ServerReadinessService } from "../runtime/ServerReadiness.js"
import type { DatabaseService } from "../db/Database.js"

type RouteDependencies = {
  readonly orchestration: OrchestrationServiceShape
  readonly pushBus: PushBusService
  readonly readiness: ServerReadinessService
  readonly database: DatabaseService
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

async function handleSendTurn(
  id: string,
  params: unknown,
  dependencies: RouteDependencies,
): Promise<string> {
  const decoded = decodeParams(SendTurnParams, params, id, "sendTurn params are invalid")
  if (typeof decoded === "string") {
    return decoded
  }

  return encodeSuccess(
    id,
    await dependencies.orchestration.sendTurn(id, decoded.threadId, decoded.content, decoded.model ?? null),
  )
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
    default:
      return null
  }
}

/**
 * Routes a single RPC frame, validating envelopes and params before invoking server handlers.
 */
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
      ?? await handleOrchestrationMethod(decoded, dependencies)
      ?? await handleOnboardingMethod(decoded, dependencies)

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
