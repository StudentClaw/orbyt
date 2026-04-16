import { EventEmitter } from "node:events"
import { WebSocket } from "ws"
import {
  PUSH_CHANNELS,
  type ActivityFeedEntry,
  type RpcPushEnvelope,
} from "@student-claw/contracts"
import type { PushDeliveryService } from "./push-delivery-service.js"
import type { PushStore } from "./push-store.js"

type WebSocketLike = EventEmitter & {
  close: () => void
  send?: (payload: string) => void
}

type WebSocketFactory = (url: string, protocols: string[]) => WebSocketLike

function parsePushEnvelope(raw: string): { channel?: string; data?: unknown } | null {
  try {
    return JSON.parse(raw) as { channel?: string; data?: unknown }
  } catch {
    return null
  }
}

function isQuietHour(now: Date, quietStart: string, quietEnd: string): boolean {
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const toMinutes = (value: string): number => {
    const [hours = "0", minutes = "0"] = value.split(":")
    return Number(hours) * 60 + Number(minutes)
  }
  const start = toMinutes(quietStart)
  const end = toMinutes(quietEnd)

  if (start === end) {
    return false
  }

  if (start < end) {
    return currentMinutes >= start && currentMinutes < end
  }

  return currentMinutes >= start || currentMinutes < end
}

export class PushActivityBridge {
  private socket: WebSocketLike | null = null

  constructor(private readonly options: {
    readonly wsUrl: string
    readonly wsAuthToken: string
    readonly store: PushStore
    readonly delivery: Pick<PushDeliveryService, "send">
    readonly webSocketFactory?: WebSocketFactory
    readonly now?: () => Date
  }) {}

  start(): void {
    if (this.socket) {
      return
    }

    const createSocket = this.options.webSocketFactory
      ?? ((url: string, protocols: string[]) => new WebSocket(url, protocols) as unknown as WebSocketLike)

    const socket = createSocket(this.options.wsUrl, [
      "student-claw.v1",
      `auth.${this.options.wsAuthToken}`,
    ])
    socket.on("open", () => {
      socket.send?.(JSON.stringify({
        kind: "request",
        id: "push-activity-feed",
        method: "activity.subscribeFeed",
        params: {},
      }))
    })
    socket.on("message", (data) => {
      void this.handleMessage(String(data))
    })
    this.socket = socket
  }

  stop(): void {
    this.socket?.close()
    this.socket = null
  }

  private async handleMessage(raw: string): Promise<void> {
    const envelope = parsePushEnvelope(raw)
    if (!envelope || envelope.channel !== PUSH_CHANNELS.ACTIVITY_FEED) {
      return
    }

    const entry = envelope.data as ActivityFeedEntry
    if ((entry.priority ?? 0) < 3) {
      return
    }

    const settings = this.options.store.getSettings()
    if (!settings.enabled || !settings.workflowEventsEnabled || !settings.linkedDevice) {
      return
    }

    const now = this.options.now?.() ?? new Date()
    if (isQuietHour(now, settings.quietHoursStart, settings.quietHoursEnd)) {
      return
    }

    await this.options.delivery.send({
      title: entry.title,
      body: entry.body ?? "",
      deepLink: entry.deepLink,
      tag: entry.type,
    })
  }
}
