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

export async function routeMessage(
  raw: string,
  ws: WebSocket,
  dependencies: RouteDependencies,
): Promise<string> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return encodeError("unknown", "parse_error", "Invalid JSON request")
  }

  const request = Schema.decodeUnknownEither(RpcRequestEnvelope)(parsed)
  if (request._tag === "Left") {
    return encodeError("unknown", "invalid_request", "Request did not match the RPC envelope")
  }

  const { id, method, params } = request.right

  try {
    switch (method) {
      case RPC_METHODS.SERVER_GET_BOOTSTRAP: {
        const bootstrap = await dependencies.orchestration.getDesktopBootstrap()
        return encodeSuccess(id, bootstrap)
      }
      case RPC_METHODS.SERVER_GET_CONFIG: {
        const config = await dependencies.orchestration.getServerConfig()
        return encodeSuccess(id, config)
      }
      case RPC_METHODS.SERVER_SUBSCRIBE_LIFECYCLE: {
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
      case RPC_METHODS.SERVER_SUBSCRIBE_CONFIG: {
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
      case RPC_METHODS.ORCHESTRATION_SUBSCRIBE_DOMAIN: {
        dependencies.pushBus.subscribe(ws, PUSH_CHANNELS.ORCHESTRATION_DOMAIN)
        return encodeSuccess(id, { subscribed: true })
      }
      case RPC_METHODS.PROVIDER_SUBSCRIBE_RUNTIME: {
        dependencies.pushBus.subscribe(ws, PUSH_CHANNELS.PROVIDER_RUNTIME)
        return encodeSuccess(id, { subscribed: true })
      }
      case RPC_METHODS.ORCHESTRATION_GET_SNAPSHOT: {
        const snapshot = await dependencies.orchestration.getSnapshot()
        return encodeSuccess(id, Schema.encodeSync(OrchestrationSnapshot)(snapshot))
      }
      case RPC_METHODS.ORCHESTRATION_CREATE_THREAD: {
        const decoded = Schema.decodeUnknownEither(CreateThreadParams)(params)
        if (decoded._tag === "Left") {
          return encodeError(id, "invalid_params", "createThread params are invalid")
        }
        const result = await dependencies.orchestration.createThread(id, decoded.right.title)
        return encodeSuccess(id, result)
      }
      case RPC_METHODS.ORCHESTRATION_SEND_TURN: {
        const decoded = Schema.decodeUnknownEither(SendTurnParams)(params)
        if (decoded._tag === "Left") {
          return encodeError(id, "invalid_params", "sendTurn params are invalid")
        }
        const result = await dependencies.orchestration.sendTurn(
          id,
          decoded.right.threadId,
          decoded.right.content,
        )
        return encodeSuccess(id, result)
      }
      case RPC_METHODS.ORCHESTRATION_INTERRUPT_TURN: {
        const decoded = Schema.decodeUnknownEither(InterruptTurnParams)(params)
        if (decoded._tag === "Left") {
          return encodeError(id, "invalid_params", "interruptTurn params are invalid")
        }
        const result = await dependencies.orchestration.interruptTurn(id, decoded.right.threadId)
        return encodeSuccess(id, result)
      }
      default:
        return encodeError(id, "method_not_found", `Method not implemented: ${method}`)
    }
  } catch (error) {
    return encodeError(
      id,
      "internal_error",
      error instanceof Error ? error.message : "Unknown routing error",
    )
  }
}
