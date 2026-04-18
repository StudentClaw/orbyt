import { describe, expect, test } from "bun:test"
import type { ExtensionRegistryEntry } from "@student-claw/contracts"
import { PluginManager } from "../plugins/plugin-manager.js"

const availableEntry: Extract<ExtensionRegistryEntry, { kind: "available" }> = {
  kind: "available",
  manifest: {
    id: "template-mcp",
    name: "Template MCP",
    description: "Template extension",
    version: "0.1.0",
    transport: {
      type: "local_stdio",
      entry: "dist/index.js",
    },
    permissions: ["template"],
    auth: {
      type: "none",
    },
    tools: [{ name: "template_ping", description: "Ping" }],
    author: "student-claw",
    homepage: "https://github.com/StudentClaw/student-claw",
  },
  installSource: "bundled",
  status: "discovered",
  enabled: true,
}

const canvasEntry: Extract<ExtensionRegistryEntry, { kind: "available" }> = {
  kind: "available",
  manifest: {
    id: "canvas-mcp",
    name: "Canvas Assistant",
    description: "Canvas extension",
    version: "0.1.0",
    transport: {
      type: "local_stdio",
      entry: "dist/index.js",
    },
    permissions: ["canvas"],
    auth: {
      type: "manual_token",
      instructions: "Paste your Canvas base URL and token.",
      fields: [
        {
          key: "baseUrl",
          label: "Canvas base URL",
          type: "base_url",
          required: true,
          placeholder: "https://myschool.instructure.com",
        },
        {
          key: "token",
          label: "Canvas access token",
          type: "secret",
          required: true,
          placeholder: "Paste your Canvas access token",
        },
      ],
    },
    tools: [{ name: "list_courses", description: "List courses" }],
    author: "student-claw",
    homepage: "https://github.com/StudentClaw/student-claw",
  },
  installSource: "bundled",
  status: "discovered",
  enabled: true,
}

type FakeRegistryEntry = ExtensionRegistryEntry

class FakeSandbox {
  readonly closeListeners = new Set<(details: { code: number | null; signal: NodeJS.Signals | null }) => void>()
  pid = 4242
  startCalls = 0
  stopCalls = 0
  listToolsCalls = 0
  callToolCalls = 0
  sendMessageCalls = 0
  startError: Error | null = null
  callToolError = false
  listedTools = [{ name: "template_ping", description: "Ping" }]
  messages: unknown[] = []

  async start(): Promise<void> {
    this.startCalls += 1
    if (this.startError) {
      throw this.startError
    }
  }

  async listTools() {
    this.listToolsCalls += 1
    return {
      tools: this.listedTools,
    }
  }

  async callTool() {
    this.callToolCalls += 1
    return {
      content: [{ type: "text", text: "template-pong" }],
      isError: this.callToolError,
    }
  }

  sendMessage(message: unknown): void {
    this.sendMessageCalls += 1
    this.messages.push(message)
  }

  async stop(): Promise<void> {
    this.stopCalls += 1
  }

  onDidClose(listener: (details: { code: number | null; signal: NodeJS.Signals | null }) => void): () => void {
    this.closeListeners.add(listener)
    return () => {
      this.closeListeners.delete(listener)
    }
  }

  emitClose(): void {
    for (const listener of this.closeListeners) {
      listener({ code: null, signal: null })
    }
  }
}

function createRegistry(entry: FakeRegistryEntry = availableEntry) {
  const pluginId = entry.kind === "available" ? entry.manifest.id : entry.pluginId
  return {
    list: () => [entry],
    getStatus: (candidatePluginId: string) => (candidatePluginId === pluginId ? entry : null),
    getAvailableRecord: (candidatePluginId: string) => {
      if (candidatePluginId !== pluginId || entry.kind !== "available") {
        return null
      }

      return {
        entry,
        manifestPath: `/tmp/${pluginId}/manifest.json`,
      }
    },
  }
}

describe("PluginManager", () => {
  test("promotes a healthy plugin to active and overlays registry state", async () => {
    const sandbox = new FakeSandbox()
    const manager = new PluginManager({
      registry: createRegistry(),
      createSandbox: () => sandbox,
    })

    const result = await manager.start("template-mcp")

    expect(result).toEqual({
      ok: true,
      pluginId: "template-mcp",
      status: "active",
    })
    expect(manager.getStatus("template-mcp")).toMatchObject({
      kind: "available",
      status: "active",
    })
    expect(sandbox.startCalls).toBe(1)
    expect(sandbox.listToolsCalls).toBe(1)
    expect(sandbox.callToolCalls).toBe(1)
    expect(sandbox.sendMessageCalls).toBe(0)
  })

  test("delivers stored credentials to a plugin after startup", async () => {
    const sandbox = new FakeSandbox()
    sandbox.listedTools = [{ name: "list_courses", description: "List courses" }]
    const manager = new PluginManager({
      registry: createRegistry(canvasEntry),
      createSandbox: () => sandbox,
      getCredentialMessage: (pluginId) => ({
        type: "plugin.credentials",
        pluginId,
        payload: {
          baseUrl: "https://myschool.instructure.com",
          token: "12345678901234567890",
        },
      }),
    })

    const result = await manager.start("canvas-mcp")

    expect(result).toEqual({
      ok: true,
      pluginId: "canvas-mcp",
      status: "active",
    })
    expect(sandbox.sendMessageCalls).toBe(1)
    expect(sandbox.messages[0]).toEqual({
      type: "plugin.credentials",
      pluginId: "canvas-mcp",
      payload: {
        baseUrl: "https://myschool.instructure.com",
        token: "12345678901234567890",
      },
    })
    expect(sandbox.callToolCalls).toBe(0)
  })

  test("moves to stopped after the idle timer fires", async () => {
    const scheduled: Array<() => void> = []
    const sandbox = new FakeSandbox()
    const manager = new PluginManager({
      registry: createRegistry(),
      createSandbox: () => sandbox,
      idleTimeoutMs: 30_000,
      scheduleTimeout: ((callback: Parameters<typeof setTimeout>[0]) => {
        scheduled.push(callback as () => void)
        return scheduled.length as unknown as ReturnType<typeof setTimeout>
      }) as typeof globalThis.setTimeout,
      clearScheduledTimeout: (() => undefined) as typeof globalThis.clearTimeout,
    })

    await manager.start("template-mcp")
    scheduled[0]?.()
    await Promise.resolve()
    await Promise.resolve()

    expect(manager.getStatus("template-mcp")).toMatchObject({
      kind: "available",
      status: "stopped",
    })
    expect(sandbox.stopCalls).toBe(1)
  })

  test("stays active by default without scheduling an idle stop", async () => {
    const scheduled: Array<() => void> = []
    const sandbox = new FakeSandbox()
    const manager = new PluginManager({
      registry: createRegistry(),
      createSandbox: () => sandbox,
      scheduleTimeout: ((callback: Parameters<typeof setTimeout>[0]) => {
        scheduled.push(callback as () => void)
        return scheduled.length as unknown as ReturnType<typeof setTimeout>
      }) as typeof globalThis.setTimeout,
      clearScheduledTimeout: (() => undefined) as typeof globalThis.clearTimeout,
    })

    await manager.start("template-mcp")

    expect(scheduled).toEqual([])
    expect(manager.getStatus("template-mcp")).toMatchObject({
      kind: "available",
      status: "active",
    })
    expect(sandbox.stopCalls).toBe(0)
  })

  test("transitions to error when the sandbox closes unexpectedly", async () => {
    const sandbox = new FakeSandbox()
    const manager = new PluginManager({
      registry: createRegistry(),
      createSandbox: () => sandbox,
    })

    await manager.start("template-mcp")
    sandbox.emitClose()

    expect(manager.getStatus("template-mcp")).toMatchObject({
      kind: "available",
      status: "error",
    })
  })

  test("retries with backoff until a later attempt succeeds", async () => {
    const sandboxes = [new FakeSandbox(), new FakeSandbox(), new FakeSandbox()]
    sandboxes[0]!.startError = new Error("boot failed once")
    sandboxes[1]!.startError = new Error("boot failed twice")
    let callCount = 0

    const manager = new PluginManager({
      registry: createRegistry(),
      createSandbox: () => sandboxes[callCount++]!,
      retryDelaysMs: [0, 0, 0],
    })

    const result = await manager.retry("template-mcp")

    expect(result).toEqual({
      ok: true,
      pluginId: "template-mcp",
      status: "active",
    })
    expect(callCount).toBe(3)
  })

  test("returns a typed failure for unsupported transports", async () => {
    const manager = new PluginManager({
      registry: createRegistry({
        ...availableEntry,
        manifest: {
          ...availableEntry.manifest,
          transport: {
            type: "remote_http",
            entry: "https://example.com/mcp",
          } as never,
        },
      }),
    })

    const result = await manager.start("template-mcp")
    expect(result).toEqual({
      ok: false,
      pluginId: "template-mcp",
      reason: "unsupported_transport",
    })
  })
})
