import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { WsTransport } from "./wsTransport"

class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3
  static instances: MockWebSocket[] = []

  readonly url: string
  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  readonly sent: string[] = []

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(payload: string) {
    this.sent.push(payload)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  open() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  message(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
}

describe("WsTransport", () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.useFakeTimers()
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test("replays the current connection state to late listeners", async () => {
    const transport = new WsTransport("ws://localhost:3020")
    const connectPromise = transport.connect()
    const socket = MockWebSocket.instances[0]!
    socket.open()
    await connectPromise

    const listener = vi.fn()
    const unsubscribe = transport.onStatusChange(listener)

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "connected", wsUrl: "ws://localhost:3020" }),
    )

    unsubscribe()
  })

  test("re-subscribes stream listeners after reconnect", async () => {
    const transport = new WsTransport("ws://localhost:3020")
    const onResubscribe = vi.fn()

    const unsubscribe = transport.subscribe(
      "server.lifecycle",
      "server.subscribeLifecycle",
      () => undefined,
      { onResubscribe },
    )

    const firstSocket = MockWebSocket.instances[0]!
    firstSocket.open()
    await Promise.resolve()

    const reconnectPromise = transport.reconnect()
    const secondSocket = MockWebSocket.instances[1]!
    secondSocket.open()
    await reconnectPromise

    const firstSubscribe = JSON.parse(firstSocket.sent[0]!)
    const secondSubscribe = JSON.parse(secondSocket.sent[0]!)

    expect(firstSubscribe.method).toBe("server.subscribeLifecycle")
    expect(secondSubscribe.method).toBe("server.subscribeLifecycle")
    expect(onResubscribe).toHaveBeenCalledOnce()

    unsubscribe()
  })
})
