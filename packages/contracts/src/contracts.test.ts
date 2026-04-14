import { describe, expect, test } from "bun:test"
import { Schema } from "@effect/schema"
import {
  DesktopBootstrap,
  GatewayToolCallResult,
  GatewayToolInventoryReadResult,
  GatewayToolsChangedEvent,
  MAX_THREAD_TITLE_LENGTH,
  MAX_TURN_CONTENT_LENGTH,
  OrchestrationSnapshot,
  ProviderRuntimeEvent,
  CreateThreadParams,
  DeleteThreadParams,
  SendTurnParams,
  RenameThreadParams,
  OrchestrationDomainEvent,
  ServerConfig,
  ServerLifecycleEvent,
  RpcRequestEnvelope,
} from "./index.js"

describe("@student-claw/contracts", () => {
  test("decodes the RPC request envelope", () => {
    const decoded = Schema.decodeUnknownSync(RpcRequestEnvelope)({
      kind: "request",
      id: "req_1",
      method: "server.getBootstrap",
      params: {},
    })

    expect(decoded.method).toBe("server.getBootstrap")
  })

  test("decodes bootstrap, config, lifecycle, and snapshot payloads", () => {
    const bootstrap = Schema.decodeUnknownSync(DesktopBootstrap)({
      wsUrl: "ws://127.0.0.1:8787",
      wsAuthToken: "a".repeat(64),
      appVersion: "0.1.0",
      platform: "darwin",
      featureFlags: {
        pluginSystem: false,
      },
    })
    const config = Schema.decodeUnknownSync(ServerConfig)({
      appVersion: "0.1.0",
      platform: "darwin",
      protocolVersion: "rpc-v1",
      capabilities: {
        orchestration: true,
        providerRuntime: true,
        desktopBootstrap: true,
      },
      featureFlags: {
        pluginSystem: false,
      },
    })
    const lifecycle = Schema.decodeUnknownSync(ServerLifecycleEvent)({
      type: "welcome",
      payload: {
        bootstrap,
        connectedAt: "2026-04-09T12:00:00.000Z",
      },
    })
    const snapshot = Schema.decodeUnknownSync(OrchestrationSnapshot)({
      workspaces: [],
      threads: [],
      turns: [],
      providerStatus: "idle",
      providerRuntime: {
        adapter: "codex",
        status: "idle",
        authState: "authenticated",
        lastError: null,
        queuedTurnCount: 0,
        lastUpdatedAt: "2026-04-09T12:00:00.000Z",
      },
      ready: true,
      lastSequence: 0,
    })

    expect(bootstrap.wsUrl).toContain("127.0.0.1")
    expect(bootstrap.featureFlags.pluginSystem).toBe(false)
    expect(config.protocolVersion).toBe("rpc-v1")
    expect(config.featureFlags.pluginSystem).toBe(false)
    expect(lifecycle.payload.bootstrap.platform).toBe("darwin")
    expect(snapshot.ready).toBe(true)
    expect(snapshot.providerRuntime.adapter).toBe("codex")
  })

  test("decodes provider runtime state-change events", () => {
    const event = Schema.decodeUnknownSync(ProviderRuntimeEvent)({
      type: "provider.stateChanged",
      state: {
        adapter: "codex",
        status: "auth_required",
        authState: "auth_required",
        lastError: {
          code: "codex_auth_required",
          message: "Codex CLI is not authenticated.",
        },
        queuedTurnCount: 2,
        lastUpdatedAt: "2026-04-09T12:05:00.000Z",
      },
    })

    expect(event.type).toBe("provider.stateChanged")
    expect(event.state.queuedTurnCount).toBe(2)
  })

  test("decodes gateway bridge contracts and provider MCP tool-call events", () => {
    const inventory = Schema.decodeUnknownSync(GatewayToolInventoryReadResult)({
      snapshot: {
        revision: 1,
        observedAt: "2026-04-11T12:00:00.000Z",
        tools: [
          {
            exposedToolName: "template.template_ping",
            description: "Ping",
            pluginId: "template-mcp",
            rawToolName: "template_ping",
          },
        ],
      },
    })

    const callResult = Schema.decodeUnknownSync(GatewayToolCallResult)({
      ok: false,
      exposedToolName: "template.template_ping",
      reason: "plugin_not_running",
      message: "Plugin template-mcp is not running.",
      pluginId: "template-mcp",
      rawToolName: "template_ping",
    })

    const changed = Schema.decodeUnknownSync(GatewayToolsChangedEvent)({
      type: "toolsChanged",
      snapshot: inventory.snapshot,
    })

    const runtimeEvent = Schema.decodeUnknownSync(ProviderRuntimeEvent)({
      type: "provider.mcpToolCall",
      threadId: "thread_1",
      turnId: "turn_1",
      itemId: "item_1",
      serverName: "student-claw",
      toolName: "template.template_ping",
      args: {},
      status: "pending",
      message: "Calling tool",
    })

    expect(inventory.snapshot.tools[0]?.exposedToolName).toBe("template.template_ping")
    expect(callResult.ok).toBe(false)
    expect(changed.snapshot.revision).toBe(1)
    expect(runtimeEvent.type).toBe("provider.mcpToolCall")
  })

  test("rejects oversized thread titles and turn content", () => {
    expect(() =>
      Schema.decodeUnknownSync(CreateThreadParams)({
        workspaceId: "workspace_1",
        title: "x".repeat(MAX_THREAD_TITLE_LENGTH + 1),
      })
    ).toThrow()

    expect(() =>
      Schema.decodeUnknownSync(SendTurnParams)({
        threadId: "thread_1",
        content: "x".repeat(MAX_TURN_CONTENT_LENGTH + 1),
      })
    ).toThrow()
  })

  test("decodes thread rename, thread delete, and thread domain events", () => {
    const rename = Schema.decodeUnknownSync(RenameThreadParams)({
      threadId: "thread_1",
      title: "Renamed thread",
    })

    const remove = Schema.decodeUnknownSync(DeleteThreadParams)({
      threadId: "thread_1",
    })

    const event = Schema.decodeUnknownSync(OrchestrationDomainEvent)({
      type: "thread.deleted",
      threadId: "thread_1",
      workspaceId: "workspace_1",
    })

    expect(rename.title).toBe("Renamed thread")
    expect(remove.threadId).toBe("thread_1")
    expect(event.type).toBe("thread.deleted")
  })
})
