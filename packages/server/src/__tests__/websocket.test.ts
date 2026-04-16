import { describe, test, expect } from "bun:test"
import { Database as BunDatabase } from "bun:sqlite"
import { RPC_METHODS, type ThreadId, type TurnId } from "@student-claw/contracts"
import { routeMessage } from "../ws/Router.js"

const mockWs = { readyState: 1, send: () => undefined } as never

function makeDependencies() {
  const threadId = "thread_1" as ThreadId
  const turnId = "turn_1" as TurnId
  const db = new BunDatabase(":memory:")
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
        wsAuthToken: "a".repeat(64),
        appVersion: "0.1.0",
        platform: "test",
        featureFlags: {
          pluginSystem: false,
        },
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
        defaultChatModel: "gpt-5.4-mini",
        chatModels: [
          {
            id: "gpt-5.4-mini",
            label: "GPT-5.4 Mini",
            description: "Fast default model",
            group: "standard" as const,
          },
        ],
        featureFlags: {
          pluginSystem: false,
        },
      }),
      getSnapshot: async () => ({
        workspaces: [],
        threads: [],
        turns: [],
        pendingApprovals: [],
        providerStatus: "idle" as const,
        providerRuntime: {
          adapter: "codex" as const,
          status: "idle" as const,
          authState: "authenticated" as const,
          lastError: null,
          queuedTurnCount: 0,
          lastUpdatedAt: "2026-04-09T12:00:00.000Z",
        },
        ready: true,
        lastSequence: 1,
      }),
      createWorkspace: async () => ({ workspaceId: "workspace_1" as never }),
      relinkWorkspace: async () => ({ workspaceId: "workspace_1" as never }),
      deleteWorkspace: async () => ({ deleted: true }),
      createThread: async () => ({ threadId }),
      renameThread: async () => ({ threadId }),
      deleteThread: async () => ({ deleted: true }),
      setThreadAccessMode: async () => ({ threadId, accessMode: "default" as const }),
      sendTurn: async () => ({ turnId }),
      interruptTurn: async () => ({ interrupted: true }),
      startProviderAuth: async () => ({ started: true }),
      retryProviderInitialize: async () => ({ started: true }),
      respondToProviderApproval: async () => ({ approvalRequestId: "approval_1", resolved: true }),
    },
    database: {
      db,
      get: () => null,
      query: () => [],
      execute: () => undefined,
      transaction: <T>(fn: () => T) => fn(),
      close: () => db.close(),
    },
  }
}

describe("Router", () => {
  test("server.getBootstrap returns a success response", async () => {
    const response = JSON.parse(
      (await routeMessage(JSON.stringify({
        kind: "request",
        method: RPC_METHODS.SERVER_GET_BOOTSTRAP,
        id: "1",
        params: {},
      }), mockWs, makeDependencies())).response,
    )
    expect(response.kind).toBe("response")
    expect(response.ok).toBe(true)
    expect(response.result.wsUrl).toContain("127.0.0.1")
  })

  test("server.getConfig returns a success response", async () => {
    const response = JSON.parse(
      (await routeMessage(JSON.stringify({
        kind: "request",
        method: RPC_METHODS.SERVER_GET_CONFIG,
        id: "2",
        params: {},
      }), mockWs, makeDependencies())).response,
    )
    expect(response.kind).toBe("response")
    expect(response.ok).toBe(true)
    expect(response.result.protocolVersion).toBe("rpc-v1")
  })

  test("invalid JSON returns error response", async () => {
    const response = await routeMessage("not json", mockWs, makeDependencies())
    const parsed = JSON.parse(response.response)
    expect(response.close?.code).toBe(1007)
    expect(parsed.kind).toBe("response")
    expect(parsed.ok).toBe(false)
    expect(parsed.error.code).toBe("parse_error")
  })

  test("invalid request envelope returns error", async () => {
    const response = await routeMessage(
      JSON.stringify({ method: "unknown", id: "1", params: {} }),
      mockWs,
      makeDependencies(),
    )
    const parsed = JSON.parse(response.response)
    expect(response.close?.code).toBe(1007)
    expect(parsed.ok).toBe(false)
    expect(parsed.error.code).toBe("invalid_request")
  })

  test("unimplemented method returns not-found error", async () => {
    const response = JSON.parse(
      (await routeMessage(JSON.stringify({
        kind: "request",
        method: "unknown.method",
        id: "1",
        params: {},
      }), mockWs, makeDependencies())).response,
    )
    expect(response.kind).toBe("response")
    expect(response.ok).toBe(false)
    expect(response.error.code).toBe("method_not_found")
  })
})
