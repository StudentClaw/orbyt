import { describe, test, expect } from "vitest"
import { WsClient } from "../lib/ws-client"

describe("WsClient", () => {
  test("initializes with disconnected state", () => {
    const client = new WsClient("ws://localhost:9999")
    expect(client.state).toBe("disconnected")
  })

  test("subscribe returns unsubscribe function", () => {
    const client = new WsClient("ws://localhost:9999")
    const unsub = client.subscribe("test", () => {})
    expect(typeof unsub).toBe("function")
    unsub()
  })

  test("onStateChange returns unsubscribe function", () => {
    const client = new WsClient("ws://localhost:9999")
    const unsub = client.onStateChange(() => {})
    expect(typeof unsub).toBe("function")
    unsub()
  })
})
