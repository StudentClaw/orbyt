import { Schema } from "@effect/schema"
import {
  WS_PROTOCOL,
  RpcServerEnvelope,
  type DesktopBootstrap,
  type RpcPushEnvelope,
} from "@orbyt/contracts"
import { createId } from "@orbyt/shared-runtime"

/**
 * Connection lifecycle phases emitted by the authenticated WebSocket transport.
 */
export type TransportConnectionPhase = "connecting" | "connected" | "disconnected" | "reconnecting"

/**
 * Snapshot of the current authenticated WebSocket transport state.
 */
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
const AUTH_PROTOCOL_PREFIX = "auth."

type TransportBootstrap = Pick<DesktopBootstrap, "wsUrl" | "wsAuthToken">

/**
 * Authenticated WebSocket transport that handles reconnects, requests, and stream subscriptions.
 */
export class WsTransport {
  private ws: WebSocket | null = null
  private url: string
  private authToken: string
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
  private bootstrapRefresher: (() => Promise<TransportBootstrap | null>) | null = null

  constructor(bootstrap: TransportBootstrap) {
    this.url = bootstrap.wsUrl
    this.authToken = bootstrap.wsAuthToken
    this.status = {
      phase: "disconnected",
      wsUrl: bootstrap.wsUrl,
      lastSequence: 0,
      lastError: null,
    }
  }

  setBootstrap(bootstrap: TransportBootstrap): void {
    this.url = bootstrap.wsUrl
    this.authToken = bootstrap.wsAuthToken
    this.setStatus((current) => ({
      ...current,
      wsUrl: bootstrap.wsUrl,
    }))
  }

  /**
   * Registers a callback that is invoked before each connection attempt.
   * Use this to refresh the auth token when the server may have restarted.
   */
  registerBootstrapRefresher(fn: () => Promise<TransportBootstrap | null>): void {
    this.bootstrapRefresher = fn
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

      const ws = this.ws
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        this.inflightRequests.delete(id)
        reject(new Error("Transport is not connected"))
        return
      }

      ws.send(JSON.stringify({
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
    this.updateConnectingStatus()
    this.connectPromise = this.startConnectionAttempt()

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

  private async startConnectionAttempt(): Promise<void> {
    if (this.bootstrapRefresher) {
      const fresh = await this.bootstrapRefresher().catch(() => null)
      if (fresh) {
        this.url = fresh.wsUrl
        this.authToken = fresh.wsAuthToken
      }
    }
    return new Promise<void>((resolve, reject) => {
      const ws = this.createSocket()
      this.attachSocketHandlers(ws, resolve, reject)
    })
  }

  private createSocket(): WebSocket {
    const ws = new WebSocket(this.url, this.buildProtocols())
    this.ws = ws
    return ws
  }

  private buildProtocols(): string[] {
    return [WS_PROTOCOL, `${AUTH_PROTOCOL_PREFIX}${this.authToken}`]
  }

  private attachSocketHandlers(
    ws: WebSocket,
    resolve: () => void,
    reject: (error: Error) => void,
  ): void {
    ws.onopen = () => this.handleSocketOpen(resolve)
    ws.onmessage = (event) => this.handleSocketMessage(event.data)
    ws.onerror = () => this.handleSocketError()
    ws.onclose = () => this.handleSocketClose(reject)
  }

  private handleSocketOpen(resolve: () => void): void {
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

  private handleSocketMessage(data: unknown): void {
    if (typeof data !== "string") {
      return
    }

    this.handleMessage(data)
  }

  private handleSocketError(): void {
    this.setStatus((current) => ({
      ...current,
      lastError: "Transport error",
    }))
  }

  private handleSocketClose(reject: (error: Error) => void): void {
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

  private updateConnectingStatus(): void {
    const phase = this.hasConnectedOnce ? "reconnecting" : "connecting"
    this.setStatus((current) => ({
      ...current,
      phase,
      wsUrl: this.url,
    }))
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
