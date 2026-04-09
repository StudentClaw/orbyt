import { Schema } from "@effect/schema"
import {
  RPC_METHODS,
  RpcServerEnvelope,
  type DesktopBootstrap,
  type RpcPushEnvelope,
} from "@student-claw/contracts"
import { createId } from "@student-claw/shared-runtime"

export type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting"

type EventCallback = (event: RpcPushEnvelope) => void
type StateCallback = (state: ConnectionState) => void

export class WsClient {
  private ws: WebSocket | null = null
  private url: string
  private subscribers = new Map<string, Set<EventCallback>>()
  private stateListeners = new Set<StateCallback>()
  private inflightRequests = new Map<string, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
  }>()
  private subscribedChannels = new Set<string>()
  private _state: ConnectionState = "disconnected"
  private reconnectAttempt = 0
  private maxReconnectDelay = 30000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldReconnect = true

  constructor(url: string) {
    this.url = url
  }

  setUrl(url: string): void {
    this.url = url
  }

  get state(): ConnectionState {
    return this._state
  }

  private setState(state: ConnectionState) {
    this._state = state
    for (const listener of this.stateListeners) {
      listener(state)
    }
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.shouldReconnect = true
    this.setState("connecting")

    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      this.reconnectAttempt = 0
      this.setState("connected")
      for (const channel of this.subscribedChannels) {
        void this.request(this.subscriptionMethod(channel), {})
      }
    }

    this.ws.onmessage = (event) => {
      try {
        const parsed = Schema.decodeUnknownSync(RpcServerEnvelope)(
          JSON.parse(event.data as string),
        )

        if (parsed.kind === "response") {
          const request = this.inflightRequests.get(parsed.id)
          if (!request) return
          this.inflightRequests.delete(parsed.id)
          if (parsed.ok) {
            request.resolve(parsed.result)
          } else {
            request.reject(new Error(parsed.error.message))
          }
          return
        }

        const callbacks = this.subscribers.get(parsed.channel)
        if (!callbacks) return
        for (const cb of callbacks) {
          cb(parsed)
        }
      } catch {
        // Ignore malformed messages
      }
    }

    this.ws.onclose = () => {
      if (this.shouldReconnect) {
        this.setState("reconnecting")
        this.scheduleReconnect()
      } else {
        this.setState("disconnected")
      }
    }

    this.ws.onerror = () => {
      // onclose will fire after onerror
    }
  }

  disconnect(): void {
    this.shouldReconnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.setState("disconnected")
  }

  async request<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const id = createId("rpc")
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error("Transport not connected")
    }

    return new Promise<T>((resolve, reject) => {
      this.inflightRequests.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      })

      this.ws?.send(JSON.stringify({
        kind: "request",
        id,
        method,
        params,
      }))
    })
  }

  async getBootstrap(): Promise<DesktopBootstrap> {
    return this.request<DesktopBootstrap>(RPC_METHODS.SERVER_GET_BOOTSTRAP, {})
  }

  async getSnapshot<T>(): Promise<T> {
    return this.request<T>(RPC_METHODS.ORCHESTRATION_GET_SNAPSHOT, {})
  }

  async createThread(title?: string): Promise<{ threadId: string }> {
    return this.request(RPC_METHODS.ORCHESTRATION_CREATE_THREAD, {
      ...(title ? { title } : {}),
    })
  }

  async sendTurn(threadId: string, content: string): Promise<{ turnId: string }> {
    return this.request(RPC_METHODS.ORCHESTRATION_SEND_TURN, {
      threadId,
      content,
    })
  }

  async interruptTurn(threadId: string): Promise<{ interrupted: boolean }> {
    return this.request(RPC_METHODS.ORCHESTRATION_INTERRUPT_TURN, {
      threadId,
    })
  }

  subscribe(event: string, callback: EventCallback): () => void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set())
    }
    this.subscribers.get(event)!.add(callback)
    this.subscribedChannels.add(event)
    if (this.ws?.readyState === WebSocket.OPEN) {
      void this.request(this.subscriptionMethod(event), {})
    }
    return () => {
      this.subscribers.get(event)?.delete(callback)
    }
  }

  onStateChange(callback: StateCallback): () => void {
    this.stateListeners.add(callback)
    return () => this.stateListeners.delete(callback)
  }

  private scheduleReconnect(): void {
    const delay = Math.min(500 * Math.pow(2, this.reconnectAttempt), this.maxReconnectDelay)
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }

  private subscriptionMethod(channel: string): string {
    switch (channel) {
      case "server.lifecycle":
        return RPC_METHODS.SERVER_SUBSCRIBE_LIFECYCLE
      case "orchestration.domain":
        return RPC_METHODS.ORCHESTRATION_SUBSCRIBE_DOMAIN
      case "provider.runtime":
        return RPC_METHODS.PROVIDER_SUBSCRIBE_RUNTIME
      default:
        throw new Error(`Unknown subscription channel: ${channel}`)
    }
  }
}
