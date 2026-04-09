import { Schema } from "@effect/schema"
import { RpcServerEnvelope, type RpcPushEnvelope } from "@student-claw/contracts"
import { createId } from "@student-claw/shared-runtime"

export type TransportConnectionPhase = "connecting" | "connected" | "disconnected" | "reconnecting"

export interface TransportStatus {
  readonly phase: TransportConnectionPhase
  readonly wsUrl: string
  readonly lastSequence: number
  readonly lastError: string | null
}

interface StreamSubscriptionOptions {
  readonly onResubscribe?: () => void
}

type TransportStateListener = (status: TransportStatus) => void
type PushListener = (event: RpcPushEnvelope) => void

type ChannelSubscription = {
  readonly method: string
  readonly listeners: Set<PushListener>
  readonly onResubscribeCallbacks: Set<() => void>
}

const INITIAL_RECONNECT_DELAY_MS = 500
const MAX_RECONNECT_DELAY_MS = 30_000

export class WsTransport {
  private ws: WebSocket | null = null
  private url: string
  private status: TransportStatus
  private readonly stateListeners = new Set<TransportStateListener>()
  private readonly inflightRequests = new Map<string, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
  }>()
  private readonly subscriptions = new Map<string, ChannelSubscription>()
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldReconnect = true
  private connectPromise: Promise<void> | null = null
  private hasConnectedOnce = false

  constructor(url = "ws://127.0.0.1:8787") {
    this.url = url
    this.status = {
      phase: "disconnected",
      wsUrl: url,
      lastSequence: 0,
      lastError: null,
    }
  }

  setUrl(url: string): void {
    this.url = url
    this.setStatus((current) => ({
      ...current,
      wsUrl: url,
    }))
  }

  getStatus(): TransportStatus {
    return this.status
  }

  onStatusChange(listener: TransportStateListener, immediate = true): () => void {
    this.stateListeners.add(listener)
    if (immediate) {
      listener(this.status)
    }
    return () => {
      this.stateListeners.delete(listener)
    }
  }

  async connect(): Promise<void> {
    await this.ensureConnected()
  }

  async reconnect(): Promise<void> {
    this.teardownSocket()
    this.connectPromise = null
    this.setStatus((current) => ({
      ...current,
      phase: "reconnecting",
    }))
    await this.ensureConnected()
  }

  async dispose(): Promise<void> {
    this.shouldReconnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.failInflightRequests(new Error("Transport disposed"))
    this.teardownSocket()
    this.connectPromise = null
    this.setStatus((current) => ({
      ...current,
      phase: "disconnected",
    }))
  }

  async request<T>(method: string, params: Record<string, unknown>): Promise<T> {
    await this.ensureConnected()
    const id = createId("rpc")

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

  subscribe(
    channel: string,
    method: string,
    listener: PushListener,
    options?: StreamSubscriptionOptions,
  ): () => void {
    let entry = this.subscriptions.get(channel)
    if (!entry) {
      entry = {
        method,
        listeners: new Set(),
        onResubscribeCallbacks: new Set(),
      }
      this.subscriptions.set(channel, entry)
    }

    entry.listeners.add(listener)
    if (options?.onResubscribe) {
      entry.onResubscribeCallbacks.add(options.onResubscribe)
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      void this.sendSubscribeRequest(channel)
    } else {
      void this.ensureConnected().catch(() => undefined)
    }

    return () => {
      const current = this.subscriptions.get(channel)
      if (!current) {
        return
      }

      current.listeners.delete(listener)
      if (options?.onResubscribe) {
        current.onResubscribeCallbacks.delete(options.onResubscribe)
      }
      if (current.listeners.size === 0) {
        this.subscriptions.delete(channel)
      }
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    if (this.connectPromise) {
      return this.connectPromise
    }

    this.shouldReconnect = true
    this.connectPromise = new Promise<void>((resolve, reject) => {
      const phase = this.hasConnectedOnce ? "reconnecting" : "connecting"
      this.setStatus((current) => ({
        ...current,
        phase,
        wsUrl: this.url,
      }))

      const ws = new WebSocket(this.url)
      this.ws = ws

      ws.onopen = () => {
        const isResubscribe = this.hasConnectedOnce
        this.reconnectAttempt = 0
        this.hasConnectedOnce = true
        this.connectPromise = null
        this.setStatus((current) => ({
          ...current,
          phase: "connected",
          wsUrl: this.url,
          lastError: null,
        }))
        void this.resubscribeActiveStreams(isResubscribe)
        resolve()
      }

      ws.onmessage = (event) => {
        this.handleMessage(event.data as string)
      }

      ws.onerror = () => {
        this.setStatus((current) => ({
          ...current,
          lastError: "Transport error",
        }))
      }

      ws.onclose = () => {
        this.ws = null
        this.connectPromise = null
        this.failInflightRequests(new Error("Transport disconnected"))

        if (this.shouldReconnect) {
          this.setStatus((current) => ({
            ...current,
            phase: "reconnecting",
          }))
          this.scheduleReconnect()
        } else {
          this.setStatus((current) => ({
            ...current,
            phase: "disconnected",
          }))
        }

        if (!this.hasConnectedOnce) {
          reject(new Error("Unable to connect transport"))
        }
      }
    })

    return this.connectPromise
  }

  private handleMessage(raw: string): void {
    try {
      const parsed = Schema.decodeUnknownSync(RpcServerEnvelope)(JSON.parse(raw))

      if (parsed.kind === "response") {
        const request = this.inflightRequests.get(parsed.id)
        if (!request) {
          return
        }
        this.inflightRequests.delete(parsed.id)
        if (parsed.ok) {
          request.resolve(parsed.result)
        } else {
          request.reject(new Error(parsed.error.message))
        }
        return
      }

      this.setStatus((current) => ({
        ...current,
        lastSequence: Math.max(current.lastSequence, parsed.sequence),
      }))

      const subscription = this.subscriptions.get(parsed.channel)
      if (!subscription) {
        return
      }
      for (const listener of subscription.listeners) {
        listener(parsed)
      }
    } catch {
      // Ignore malformed frames.
    }
  }

  private async resubscribeActiveStreams(isResubscribe: boolean): Promise<void> {
    for (const [channel, subscription] of this.subscriptions.entries()) {
      void this.sendSubscribeRequest(channel).catch(() => undefined)
      if (isResubscribe) {
        for (const callback of subscription.onResubscribeCallbacks) {
          callback()
        }
      }
    }
  }

  private async sendSubscribeRequest(channel: string): Promise<void> {
    const subscription = this.subscriptions.get(channel)
    if (!subscription || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    await this.request(subscription.method, {})
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.shouldReconnect) {
      return
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempt),
      MAX_RECONNECT_DELAY_MS,
    )
    this.reconnectAttempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.ensureConnected().catch(() => undefined)
    }, delay)
  }

  private setStatus(updater: (current: TransportStatus) => TransportStatus): void {
    this.status = updater(this.status)
    for (const listener of this.stateListeners) {
      listener(this.status)
    }
  }

  private failInflightRequests(error: Error): void {
    for (const request of this.inflightRequests.values()) {
      request.reject(error)
    }
    this.inflightRequests.clear()
  }

  private teardownSocket(): void {
    if (this.ws) {
      const ws = this.ws
      this.ws = null
      ws.onclose = null
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }
  }
}
