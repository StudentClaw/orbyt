import { Context, Layer, Effect } from "effect"
import type { WebSocket } from "ws"
import { RpcPushEnvelope } from "@student-claw/contracts"
import { Schema } from "@effect/schema"

type SubscribedClient = {
  readonly channels: Set<string>
}

export interface PushBusService {
  readonly registerClient: (ws: WebSocket) => void
  readonly removeClient: (ws: WebSocket) => void
  readonly subscribe: (ws: WebSocket, channel: string) => void
  readonly publish: (channel: string, data: unknown) => Promise<number>
  readonly publishTo: (ws: WebSocket, channel: string, data: unknown) => Promise<number>
  readonly getLastSequence: () => number
}

export class PushBus extends Context.Tag("PushBus")<
  PushBus,
  PushBusService
>() {}

function sendEnvelope(
  ws: WebSocket,
  channel: string,
  sequence: number,
  data: unknown,
): void {
  ws.send(JSON.stringify(
    Schema.encodeSync(RpcPushEnvelope)({
      kind: "push",
      channel,
      sequence,
      data,
    }),
  ))
}

export const PushBusLive = Layer.effect(
  PushBus,
  Effect.sync(() => {
    const clients = new Map<WebSocket, SubscribedClient>()
    let sequence = 0

    const nextSequence = (): number => {
      sequence += 1
      return sequence
    }

    return {
      registerClient: (ws) => {
        clients.set(ws, { channels: new Set() })
      },
      removeClient: (ws) => {
        clients.delete(ws)
      },
      subscribe: (ws, channel) => {
        clients.get(ws)?.channels.add(channel)
      },
      publish: async (channel, data) => {
        const next = nextSequence()
        for (const [ws, client] of clients.entries()) {
          if (ws.readyState !== 1 || !client.channels.has(channel)) continue
          sendEnvelope(ws, channel, next, data)
        }
        return next
      },
      publishTo: async (ws, channel, data) => {
        const next = nextSequence()
        if (ws.readyState === 1) {
          sendEnvelope(ws, channel, next, data)
        }
        return next
      },
      getLastSequence: () => sequence,
    }
  }),
)
