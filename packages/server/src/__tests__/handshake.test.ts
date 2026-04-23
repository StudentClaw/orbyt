import { describe, expect, test } from "bun:test"
import type { IncomingMessage } from "node:http"
import { selectWebSocketProtocol, validateWebSocketHandshake } from "../ws/handshake.js"

const authToken = "a".repeat(64)
const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"]

function createRequest(headers: Record<string, string | undefined>): IncomingMessage {
  return {
    headers,
  } as IncomingMessage
}

describe("validateWebSocketHandshake", () => {
  test("accepts the expected protocol, auth token, and allowed origin", () => {
    const result = validateWebSocketHandshake(
      createRequest({
        origin: "http://localhost:5173",
        "sec-websocket-protocol": `orbyt.v1, auth.${authToken}`,
      }),
      { allowedOrigins, expectedAuthToken: authToken },
    )

    expect(result).toEqual({ ok: true })
  })

  test("rejects requests that omit the auth token", () => {
    const result = validateWebSocketHandshake(
      createRequest({
        origin: "http://localhost:5173",
        "sec-websocket-protocol": "orbyt.v1",
      }),
      { allowedOrigins, expectedAuthToken: authToken },
    )

    expect(result).toEqual({ ok: false, reason: "Missing auth protocol" })
  })

  test("rejects requests with the wrong auth token", () => {
    const result = validateWebSocketHandshake(
      createRequest({
        origin: "http://localhost:5173",
        "sec-websocket-protocol": `orbyt.v1, auth.${"b".repeat(64)}`,
      }),
      { allowedOrigins, expectedAuthToken: authToken },
    )

    expect(result).toEqual({ ok: false, reason: "Missing auth protocol" })
  })

  test("rejects unexpected browser origins", () => {
    const result = validateWebSocketHandshake(
      createRequest({
        origin: "https://evil.example",
        "sec-websocket-protocol": `orbyt.v1, auth.${authToken}`,
      }),
      { allowedOrigins, expectedAuthToken: authToken },
    )

    expect(result).toEqual({ ok: false, reason: "Unexpected origin" })
  })

  test("accepts packaged desktop file origins", () => {
    const result = validateWebSocketHandshake(
      createRequest({
        origin: "file://",
        "sec-websocket-protocol": `orbyt.v1, auth.${authToken}`,
      }),
      { allowedOrigins, expectedAuthToken: authToken },
    )

    expect(result).toEqual({ ok: true })
  })

  test("selects the Orbyt subprotocol during handshake", () => {
    expect(
      selectWebSocketProtocol(new Set(["orbyt.v1", `auth.${authToken}`])),
    ).toBe("orbyt.v1")
    expect(selectWebSocketProtocol(new Set([`auth.${authToken}`]))).toBe(false)
  })
})
