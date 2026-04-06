import { Context, Layer, Effect } from "effect"
import { WebSocketServer as WsServer } from "ws"
import type { WebSocket } from "ws"
import { ConfigService } from "../config/ConfigService.js"
import { routeMessage } from "./Router.js"

export interface WebSocketService {
  readonly wss: WsServer
  readonly broadcast: (data: string) => void
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

    const wss = new WsServer({ port: config.port })
    const clients = new Set<WebSocket>()

    wss.on("connection", (ws) => {
      clients.add(ws)

      ws.on("message", (data) => {
        const raw = data.toString()
        const response = routeMessage(raw)
        ws.send(response)
      })

      ws.on("close", () => {
        clients.delete(ws)
      })

      ws.on("error", () => {
        clients.delete(ws)
      })
    })

    return {
      wss,
      broadcast: (data: string) => {
        for (const client of clients) {
          if (client.readyState === 1) {
            client.send(data)
          }
        }
      },
      close: () =>
        new Promise<void>((resolve) => {
          for (const client of clients) {
            client.close()
          }
          wss.close(() => resolve())
        }),
    }
  }),
)
