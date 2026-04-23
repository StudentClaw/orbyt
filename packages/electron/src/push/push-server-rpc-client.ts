import { randomUUID } from "node:crypto"
import { WebSocket } from "ws"

type WebSocketFactory = (url: string, protocols: string[]) => WebSocket

export class PushServerRpcClient {
  constructor(
    private readonly bootstrap: {
      readonly wsUrl: string
      readonly wsAuthToken: string
    },
    private readonly webSocketFactory: WebSocketFactory = (url, protocols) => new WebSocket(url, protocols),
  ) {}

  request<Result>(method: string, params: unknown): Promise<Result> {
    return new Promise((resolve, reject) => {
      const requestId = randomUUID()
      const ws = this.webSocketFactory(this.bootstrap.wsUrl, [
        "orbyt.v1",
        `auth.${this.bootstrap.wsAuthToken}`,
      ])

      const cleanup = () => {
        ws.removeAllListeners()
        ws.close()
      }

      ws.on("open", () => {
        ws.send(JSON.stringify({
          kind: "request",
          id: requestId,
          method,
          params,
        }))
      })

      ws.on("message", (raw) => {
        try {
          const message = JSON.parse(raw.toString()) as {
            kind?: string
            id?: string
            ok?: boolean
            result?: Result
            error?: { message?: string }
          }
          if (message.kind !== "response" || message.id !== requestId) {
            return
          }

          cleanup()
          if (message.ok) {
            resolve(message.result as Result)
            return
          }

          reject(new Error(message.error?.message ?? `RPC request failed for ${method}`))
        } catch (error) {
          cleanup()
          reject(error)
        }
      })

      ws.on("error", (error) => {
        cleanup()
        reject(error)
      })
    })
  }
}
