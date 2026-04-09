import { describe, test, expect } from "bun:test"
import { RPC_METHODS, type ThreadId, type TurnId } from "@student-claw/contracts"
import { routeMessage } from "../ws/Router.js"

const mockWs = { readyState: 1, send: () => undefined } as never

function makeDependencies() {
  const threadId = "thread_1" as ThreadId
  const turnId = "turn_1" as TurnId
  return {
    readiness: {
      awaitReady: async () => undefined,
      markReady: () => undefined,
      isReady: () => true,
    },
    pushBus: {
      registerClient: () => undefined,
      removeClient: () => undefined,
      subscribe: () => undefined,
      publish: async () => 1,
      publishTo: async () => 1,
      getLastSequence: () => 1,
    },
    orchestration: {
      getDesktopBootstrap: async () => ({
        wsUrl: "ws://127.0.0.1:8787",
        appVersion: "0.1.0",
        platform: "test",
      }),
      getServerConfig: async () => ({
        appVersion: "0.1.0",
        platform: "test",
        protocolVersion: "rpc-v1",
        capabilities: {
          orchestration: true,
          providerRuntime: true,
          desktopBootstrap: true,
        },
      }),
      getSnapshot: async () => ({
        threads: [],
        turns: [],
        providerStatus: "idle" as const,
        ready: true,
        lastSequence: 1,
      }),
      createThread: async () => ({ threadId }),
      sendTurn: async () => ({ turnId }),
      interruptTurn: async () => ({ interrupted: true }),
    },
  }
}

describe("Router", () => {
  test("server.getBootstrap returns a success response", async () => {
    const response = JSON.parse(
      await routeMessage(JSON.stringify({
        kind: "request",
        method: RPC_METHODS.SERVER_GET_BOOTSTRAP,
        id: "1",
        params: {},
      }), mockWs, makeDependencies())
    )
    expect(response.kind).toBe("response")
    expect(response.ok).toBe(true)
    expect(response.result.wsUrl).toContain("127.0.0.1")
  })

  test("server.getConfig returns a success response", async () => {
    const response = JSON.parse(
      await routeMessage(JSON.stringify({
        kind: "request",
        method: RPC_METHODS.SERVER_GET_CONFIG,
        id: "2",
        params: {},
      }), mockWs, makeDependencies())
    )
    expect(response.kind).toBe("response")
    expect(response.ok).toBe(true)
    expect(response.result.protocolVersion).toBe("rpc-v1")
  })

  test("invalid JSON returns error response", async () => {
    const response = JSON.parse(await routeMessage("not json", mockWs, makeDependencies()))
    expect(response.kind).toBe("response")
    expect(response.ok).toBe(false)
    expect(response.error.code).toBe("parse_error")
  })

  test("invalid request envelope returns error", async () => {
    const response = JSON.parse(
      await routeMessage(JSON.stringify({ method: "unknown", id: "1", params: {} }), mockWs, makeDependencies())
    )
    expect(response.ok).toBe(false)
    expect(response.error.code).toBe("invalid_request")
  })

  test("unimplemented method returns not-found error", async () => {
    const response = JSON.parse(
      await routeMessage(JSON.stringify({
        kind: "request",
        method: "unknown.method",
        id: "1",
        params: {},
      }), mockWs, makeDependencies())
    )
    expect(response.ok).toBe(false)
    expect(response.error.code).toBe("method_not_found")
  })
})
