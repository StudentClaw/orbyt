import { describe, expect, test } from "bun:test"
import { Schema } from "@effect/schema"
import {
  DesktopBootstrap,
  OrchestrationSnapshot,
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
      appVersion: "0.1.0",
      platform: "darwin",
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
    })
    const lifecycle = Schema.decodeUnknownSync(ServerLifecycleEvent)({
      type: "welcome",
      payload: {
        bootstrap,
        connectedAt: "2026-04-09T12:00:00.000Z",
      },
    })
    const snapshot = Schema.decodeUnknownSync(OrchestrationSnapshot)({
      threads: [],
      turns: [],
      providerStatus: "idle",
      ready: true,
      lastSequence: 0,
    })

    expect(bootstrap.wsUrl).toContain("127.0.0.1")
    expect(config.protocolVersion).toBe("rpc-v1")
    expect(lifecycle.payload.bootstrap.platform).toBe("darwin")
    expect(snapshot.ready).toBe(true)
  })
})
