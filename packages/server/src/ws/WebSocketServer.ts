import type { IncomingMessage } from "node:http"
import { Context, Layer, Effect } from "effect"
import { WebSocketServer as WsServer } from "ws"
import type { WebSocket } from "ws"
import { ConfigService } from "../config/ConfigService.js"
import type { AppConfig } from "../config/defaults.js"
import { OrchestrationService, type OrchestrationServiceShape } from "../orchestration/OrchestrationService.js"
import { ServerReadiness, type ServerReadinessService } from "../runtime/ServerReadiness.js"
import { PushBus, type PushBusService } from "./PushBus.js"
import { Database, type DatabaseService } from "../db/Database.js"
import { CanvasSyncService, type CanvasSyncServiceShape } from "../canvas/CanvasSyncService.js"
import { SkillResolver, type SkillResolverService } from "../skills/SkillResolver.js"
import { MemorizeService, type MemorizeServiceShape } from "../memory/service.js"
import { selectWebSocketProtocol, validateWebSocketHandshake } from "./handshake.js"
import { routeMessage, type RouteMessageResult } from "./Router.js"

/**
 * Live WebSocket server handle exposed to the server runtime.
 */
export interface WebSocketService {
  readonly wss: WsServer
  readonly close: () => Promise<void>
}

/**
 * Effect service tag for the authenticated local WebSocket server.
 */
export class WebSocketServerService extends Context.Tag("WebSocketServer")<
  WebSocketServerService,
  WebSocketService
>() {}

/**
 * Starts the authenticated local WebSocket server and wires it to the RPC router.
 */
export const WebSocketServerLive = Layer.effect(
  WebSocketServerService,
  Effect.gen(function* () {
    const config = yield* ConfigService
    const readiness = yield* ServerReadiness
    const pushBus = yield* PushBus
    const orchestration = yield* OrchestrationService
    const database = yield* Database
    const canvasSync = yield* CanvasSyncService
    const skillResolver = yield* SkillResolver
    const memorize = yield* MemorizeService

    return createWebSocketService(config, readiness, pushBus, orchestration, database, canvasSync, skillResolver, memorize)
  }),
)

function sendRouteResponse(ws: WebSocket, result: RouteMessageResult): void {
  ws.send(result.response)
  if (result.close) {
    ws.close(result.close.code, result.close.reason)
  }
}

function createWebSocketService(
  config: AppConfig,
  readiness: ServerReadinessService,
  pushBus: PushBusService,
  orchestration: OrchestrationServiceShape,
  database: DatabaseService,
  canvasSync: CanvasSyncServiceShape,
  skillResolver: SkillResolverService,
  memorize: MemorizeServiceShape,
): WebSocketService {
  const wss = new WsServer({
    port: config.port,
    host: config.wsHost,
    maxPayload: config.wsMaxPayloadBytes,
    verifyClient: ({ req }: { req: IncomingMessage }) => validateWebSocketHandshake(req, {
      allowedOrigins: config.allowedOrigins,
      expectedAuthToken: config.wsAuthToken,
    }).ok,
    handleProtocols: (protocols) => selectWebSocketProtocol(protocols),
  })

  wss.on("connection", (ws) => {
    registerSocketHandlers(ws as WebSocket, config, readiness, pushBus, orchestration, database, canvasSync, skillResolver, memorize)
  })

  return {
    wss,
    close: () =>
      new Promise<void>((resolve) => {
        wss.close(() => resolve())
      }),
  }
}

function registerSocketHandlers(
  ws: WebSocket,
  config: AppConfig,
  readiness: ServerReadinessService,
  pushBus: PushBusService,
  orchestration: OrchestrationServiceShape,
  database: DatabaseService,
  canvasSync: CanvasSyncServiceShape,
  skillResolver: SkillResolverService,
  memorize: MemorizeServiceShape,
): void {
  pushBus.registerClient(ws)

  ws.on("message", async (data, isBinary) => {
    if (isBinary) {
      ws.close(1003, "Binary messages are not supported")
      return
    }

    const result = await routeMessage(data.toString(), ws, {
      config,
      orchestration,
      pushBus,
      readiness,
      database,
      canvasSync,
      skillResolver,
      memorize,
    })
    sendRouteResponse(ws, result)
  })

  ws.on("close", () => {
    pushBus.removeClient(ws)
  })

  ws.on("error", () => {
    pushBus.removeClient(ws)
  })
}
