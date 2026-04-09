import { describe, expect, test } from "bun:test"
import { Schema } from "@effect/schema"
import {
  DesktopBootstrap,
  OrchestrationSnapshot,
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

  test("decodes bootstrap and snapshot payloads", () => {
    const bootstrap = Schema.decodeUnknownSync(DesktopBootstrap)({
      wsUrl: "ws://127.0.0.1:8787",
      appVersion: "0.1.0",
      platform: "darwin",
    })
    const snapshot = Schema.decodeUnknownSync(OrchestrationSnapshot)({
      threads: [],
      turns: [],
      providerStatus: "idle",
      ready: true,
      lastSequence: 0,
    })

    expect(bootstrap.wsUrl).toContain("127.0.0.1")
    expect(snapshot.ready).toBe(true)
  })
})
