import { describe, test, expect } from "bun:test"
import { Schema } from "@effect/schema"
import {
  IpcChannel as ContractsIpcChannel,
} from "@orbyt/contracts"
import {
  ClientMessage,
  ChatSendMessage,
  HealthPing,
  ServerEvent,
  HealthPong,
  ErrorEvent,
  ChatStreaming,
  CanvasSyncProgress,
  JsonRpcRequest,
  JsonRpcResponse,
  IpcChannel,
} from "../protocol/index.js"

describe("ClientMessage union", () => {
  test("decodes chat.sendMessage by method", () => {
    const decode = Schema.decodeUnknownSync(ClientMessage)
    const msg = decode({
      method: "chat.sendMessage",
      id: "1",
      params: { content: "Hello" },
    })
    expect(msg.method).toBe("chat.sendMessage")
  })

  test("decodes health.ping by method", () => {
    const decode = Schema.decodeUnknownSync(ClientMessage)
    const msg = decode({
      method: "health.ping",
      id: "2",
      params: {},
    })
    expect(msg.method).toBe("health.ping")
  })

  test("decodes canvas.sync by method", () => {
    const decode = Schema.decodeUnknownSync(ClientMessage)
    const msg = decode({
      method: "canvas.sync",
      id: "3",
      params: {},
    })
    expect(msg.method).toBe("canvas.sync")
  })

  test("decodes dashboard.refresh by method", () => {
    const decode = Schema.decodeUnknownSync(ClientMessage)
    const msg = decode({
      method: "dashboard.refresh",
      id: "4",
      params: {},
    })
    expect(msg.method).toBe("dashboard.refresh")
  })

  test("rejects unknown method", () => {
    const decode = Schema.decodeUnknownSync(ClientMessage)
    expect(() => decode({
      method: "unknown.method",
      id: "5",
      params: {},
    })).toThrow()
  })

  test("rejects missing id", () => {
    const decode = Schema.decodeUnknownSync(ClientMessage)
    expect(() => decode({
      method: "health.ping",
      params: {},
    })).toThrow()
  })
})

describe("ServerEvent union", () => {
  test("decodes health.pong by event", () => {
    const decode = Schema.decodeUnknownSync(ServerEvent)
    const evt = decode({
      event: "health.pong",
      data: { uptime: 12345 },
    })
    expect(evt.event).toBe("health.pong")
  })

  test("decodes error event", () => {
    const decode = Schema.decodeUnknownSync(ServerEvent)
    const evt = decode({
      event: "error",
      data: { code: 400, message: "Bad request" },
    })
    expect(evt.event).toBe("error")
  })

  test("decodes chat.streaming", () => {
    const decode = Schema.decodeUnknownSync(ServerEvent)
    const evt = decode({
      event: "chat.streaming",
      data: { token: "Hello", sequenceNum: 1 },
    })
    expect(evt.event).toBe("chat.streaming")
  })

  test("decodes canvas.syncProgress", () => {
    const decode = Schema.decodeUnknownSync(ServerEvent)
    const evt = decode({
      event: "canvas.syncProgress",
      data: { courseId: "c-1", progress: 50, status: "syncing" },
    })
    expect(evt.event).toBe("canvas.syncProgress")
  })

  test("rejects unknown event", () => {
    const decode = Schema.decodeUnknownSync(ServerEvent)
    expect(() => decode({
      event: "unknown.event",
      data: {},
    })).toThrow()
  })

  test("rejects invalid syncProgress status", () => {
    const decode = Schema.decodeUnknownSync(ServerEvent)
    expect(() => decode({
      event: "canvas.syncProgress",
      data: { courseId: "c-1", progress: 50, status: "pending" },
    })).toThrow()
  })
})

describe("JSON-RPC", () => {
  test("decodes valid request", () => {
    const decode = Schema.decodeUnknownSync(JsonRpcRequest)
    const req = decode({
      jsonrpc: "2.0",
      method: "test",
      id: "1",
    })
    expect(req.jsonrpc).toBe("2.0")
    expect(req.method).toBe("test")
  })

  test("rejects non-2.0 jsonrpc", () => {
    const decode = Schema.decodeUnknownSync(JsonRpcRequest)
    expect(() => decode({
      jsonrpc: "1.0",
      method: "test",
      id: "1",
    })).toThrow()
  })

  test("decodes valid response", () => {
    const decode = Schema.decodeUnknownSync(JsonRpcResponse)
    const res = decode({
      jsonrpc: "2.0",
      id: "1",
      result: { data: "ok" },
    })
    expect(res.id).toBe("1")
  })

  test("decodes error response", () => {
    const decode = Schema.decodeUnknownSync(JsonRpcResponse)
    const res = decode({
      jsonrpc: "2.0",
      id: "1",
      error: { code: -32600, message: "Invalid request" },
    })
    expect(res.error?.code).toBe(-32600)
  })

  test("accepts numeric id", () => {
    const decode = Schema.decodeUnknownSync(JsonRpcRequest)
    const req = decode({
      jsonrpc: "2.0",
      method: "test",
      id: 42,
    })
    expect(req.id).toBe(42)
  })
})

describe("IPC channels", () => {
  test("channel values are correct", () => {
    expect(IpcChannel).toBe(ContractsIpcChannel)
    expect(IpcChannel.APP_GET_PATH).toBe("app:get-path")
    expect(IpcChannel.APP_GET_BOOTSTRAP).toBe("app:get-bootstrap")
    expect(IpcChannel.NOTIFICATION_SHOW).toBe("notification:show")
    expect(IpcChannel.TRAY_UPDATE_BADGE).toBe("tray:update-badge")
    expect(IpcChannel.FILE_OPEN_DIALOG).toBe("file:open-dialog")
    expect(IpcChannel.FILE_SAVE_DIALOG).toBe("file:save-dialog")
    expect(IpcChannel.PLUGIN_LIST).toBe("plugin:list")
    expect(IpcChannel.PLUGIN_START).toBe("plugin:start")
    expect(IpcChannel.PLUGIN_STOP).toBe("plugin:stop")
    expect(IpcChannel.PLUGIN_RETRY).toBe("plugin:retry")
    expect(IpcChannel.PLUGIN_LIFECYCLE).toBe("plugin:lifecycle")
  })
})
