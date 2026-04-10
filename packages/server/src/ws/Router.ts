import { Schema } from "@effect/schema"
import {
  CreateThreadParams,
  InterruptTurnParams,
  OrchestrationSnapshot,
  PUSH_CHANNELS,
  RPC_METHODS,
  RpcErrorResponseEnvelope,
  RpcRequestEnvelope,
  RpcSuccessResponseEnvelope,
  SendTurnParams,
  ServerConfigStreamEvent,
  ServerLifecycleEvent,
} from "@student-claw/contracts"
import type { WebSocket } from "ws"
import type { OrchestrationServiceShape } from "../orchestration/OrchestrationService.js"
import type { PushBusService } from "./PushBus.js"
import type { ServerReadinessService } from "../runtime/ServerReadiness.js"

type RouteDependencies = {
  readonly orchestration: OrchestrationServiceShape
  readonly pushBus: PushBusService
  readonly readiness: ServerReadinessService
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
    case RPC_METHODS.ORCHESTRATION_CREATE_THREAD:
      return handleCreateThread(id, params, dependencies)
    case RPC_METHODS.ORCHESTRATION_SEND_TURN:
      return handleSendTurn(id, params, dependencies)
    case RPC_METHODS.ORCHESTRATION_INTERRUPT_TURN:
      return handleInterruptTurn(id, params, dependencies)
    default:
      return null
  }
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

  return encodeSuccess(id, await dependencies.orchestration.createThread(id, decoded.title))
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
    await dependencies.orchestration.sendTurn(id, decoded.threadId, decoded.content),
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
