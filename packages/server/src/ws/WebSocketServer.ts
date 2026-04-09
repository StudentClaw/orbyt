import { Context, Layer, Effect } from "effect"
import { WebSocketServer as WsServer } from "ws"
import type { WebSocket } from "ws"
import { ConfigService } from "../config/ConfigService.js"
import { OrchestrationService } from "../orchestration/OrchestrationService.js"
import { ServerReadiness } from "../runtime/ServerReadiness.js"
import { PushBus } from "./PushBus.js"
import { routeMessage } from "./Router.js"

export interface WebSocketService {
  readonly wss: WsServer
  readonly close: () => Promise<void>
}

export class WebSocketServerService extends Context.Tag("WebSocketServer")<
  WebSocketServerService,
  WebSocketService
>() {}

export const WebSocketServerLive = Layer.effect(
  WebSocketServerService,
  Effect.gen(function* () {
    const config = yield* ConfigService
    const readiness = yield* ServerReadiness
    const pushBus = yield* PushBus
    const orchestration = yield* OrchestrationService

    const wss = new WsServer({ port: config.port })

    wss.on("connection", (ws) => {
      pushBus.registerClient(ws)

      ws.on("message", async (data) => {
        const raw = data.toString()
        const response = await routeMessage(raw, ws as WebSocket, {
          orchestration,
          pushBus,
          readiness,
        })
        ws.send(response)
      })

      ws.on("close", () => {
        pushBus.removeClient(ws)
      })

      ws.on("error", () => {
        pushBus.removeClient(ws)
      })
    })

    return {
      wss,
      close: () =>
        new Promise<void>((resolve) => {
          wss.close(() => resolve())
        }),
    }
  }),
)
