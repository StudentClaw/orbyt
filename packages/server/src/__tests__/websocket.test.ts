import { describe, test, expect } from "bun:test"
import { routeMessage } from "../ws/Router.js"

describe("Router", () => {
  test("health.ping returns health.pong", () => {
    const response = JSON.parse(
      routeMessage(JSON.stringify({
        method: "health.ping",
        id: "1",
        params: {},
      }))
    )
    expect(response.event).toBe("health.pong")
    expect(response.data.uptime).toBeGreaterThanOrEqual(0)
  })

  test("invalid JSON returns error event", () => {
    const response = JSON.parse(routeMessage("not json"))
    expect(response.event).toBe("error")
    expect(response.data.code).toBe(-32700)
  })

  test("invalid message schema returns error", () => {
    const response = JSON.parse(
      routeMessage(JSON.stringify({ method: "unknown", id: "1", params: {} }))
    )
    expect(response.event).toBe("error")
    expect(response.data.code).toBe(-32600)
  })

  test("unimplemented method returns not-implemented error", () => {
    const response = JSON.parse(
      routeMessage(JSON.stringify({
        method: "chat.sendMessage",
        id: "1",
        params: { content: "hello" },
      }))
    )
    expect(response.event).toBe("error")
    expect(response.data.code).toBe(-32601)
  })
})
