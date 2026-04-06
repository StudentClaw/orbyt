export type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting"

export interface ServerEventMessage {
  readonly event: string
  readonly data: Record<string, unknown>
}

export interface ClientMessagePayload {
  readonly method: string
  readonly id: string
  readonly params: Record<string, unknown>
}

type EventCallback = (event: ServerEventMessage) => void
type StateCallback = (state: ConnectionState) => void

export class WsClient {
  private ws: WebSocket | null = null
  private url: string
  private subscribers = new Map<string, Set<EventCallback>>()
  private stateListeners = new Set<StateCallback>()
  private _state: ConnectionState = "disconnected"
  private reconnectAttempt = 0
  private maxReconnectDelay = 30000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldReconnect = true

  constructor(url: string) {
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
    }

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as ServerEventMessage
        if (!parsed.event) return

        const eventName = parsed.event
        const callbacks = this.subscribers.get(eventName)
        if (callbacks) {
          for (const cb of callbacks) {
            cb(parsed)
          }
        }
        const wildcardCallbacks = this.subscribers.get("*")
        if (wildcardCallbacks) {
          for (const cb of wildcardCallbacks) {
            cb(parsed)
          }
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

  send(message: ClientMessagePayload): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify(message))
  }

  subscribe(event: string, callback: EventCallback): () => void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set())
    }
    this.subscribers.get(event)!.add(callback)
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
}
