import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import type { ExtensionRegistryEntry } from "@orbyt/contracts"
import { PluginManager, applyPluginSandboxEnv, buildSandboxOptions } from "../plugins/plugin-manager.js"
import { PluginEnabledStore } from "../plugins/plugin-enabled-store.js"

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
    author: "orbyt",
    homepage: "https://github.com/Orbyt/orbyt",
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
    author: "orbyt",
    homepage: "https://github.com/Orbyt/orbyt",
  },
  installSource: "bundled",
  status: "discovered",
  enabled: true,
}

const appleEntry: Extract<ExtensionRegistryEntry, { kind: "available" }> = {
  kind: "available",
  manifest: {
    id: "apple-calendar-mcp",
    name: "Apple Calendar",
    description: "Apple Calendar extension",
    version: "1.0.0",
    transport: {
      type: "local_stdio",
      entry: "dist/index.js",
    },
    permissions: ["local_os.calendar.read", "local_os.calendar.write"],
    auth: {
      type: "none",
    },
    tools: [{ name: "getCalendars", description: "List calendars" }],
    author: "orbyt",
    homepage: "https://github.com/Orbyt/orbyt",
  },
  installSource: "bundled",
  status: "discovered",
  enabled: true,
}

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-plugin-manager-"))
  tempDirs.push(dir)
  return dir
}

type FakeRegistryEntry = ExtensionRegistryEntry

class FakeSandbox {
  readonly closeListeners = new Set<(details: { code: number | null; signal: NodeJS.Signals | null }) => void>()
  readonly runtimeLogListeners = new Set<(message: string) => void>()
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

  onRuntimeLog(listener: (message: string) => void): () => void {
    this.runtimeLogListeners.add(listener)
    return () => {
      this.runtimeLogListeners.delete(listener)
    }
  }

  emitRuntimeLog(message: string): void {
    for (const listener of this.runtimeLogListeners) {
      listener(message)
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

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe("PluginManager", () => {
  test("marks plugin child processes to run as node under Electron", () => {
    expect(applyPluginSandboxEnv({ PATH: "/usr/bin" }, true)).toEqual({
      PATH: "/usr/bin",
      ELECTRON_RUN_AS_NODE: "1",
    })
    expect(applyPluginSandboxEnv({ PATH: "/usr/bin" }, false)).toEqual({
      PATH: "/usr/bin",
    })
  })

  test("builds sandbox env with runtime-injected bridge values", () => {
    const extensionDir = createTempDir()
    mkdirSync(path.join(extensionDir, "dist"), { recursive: true })
    const entryPath = path.join(extensionDir, "dist/index.js")
    writeFileSync(entryPath, "console.log('apple-calendar-mcp')")

    const options = buildSandboxOptions({
      entry: appleEntry,
      manifestPath: path.join(extensionDir, "manifest.json"),
    }, {
      MAC_API_BRIDGE_URL: "http://127.0.0.1:53412",
      MAC_API_BRIDGE_TOKEN: "bridge-token",
    })

    expect(options.env.MAC_API_BRIDGE_URL).toBe("http://127.0.0.1:53412")
    expect(options.env.MAC_API_BRIDGE_TOKEN).toBe("bridge-token")
  })

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

  test("withholds Apple Calendar startup until the bridge layer is ready", async () => {
    const sandbox = new FakeSandbox()
    let cleaned = 0
    const manager = new PluginManager({
      registry: createRegistry(appleEntry),
      createSandbox: () => sandbox,
      prepareRuntime: async () => ({
        readiness: "bridge_unavailable",
        lastError: "Apple Calendar bridge is unavailable.",
      }),
      cleanupRuntime: async () => {
        cleaned += 1
      },
    })

    const result = await manager.start("apple-calendar-mcp")

    expect(result).toEqual({
      ok: false,
      pluginId: "apple-calendar-mcp",
      reason: "start_failed",
    })
    expect(sandbox.startCalls).toBe(0)
    expect(manager.getStatus("apple-calendar-mcp")).toMatchObject({
      kind: "available",
      status: "error",
      lastError: "Apple Calendar bridge is unavailable.",
    })

    const stopResult = await manager.stop("apple-calendar-mcp")
    expect(stopResult).toEqual({
      ok: true,
      pluginId: "apple-calendar-mcp",
      status: "stopped",
    })
    expect(cleaned).toBe(1)
    expect(manager.getStatus("apple-calendar-mcp")).toMatchObject({
      kind: "available",
      status: "stopped",
      readiness: undefined,
    })
  })

  test("emits readiness transitions separately from lifecycle events", async () => {
    const sandbox = new FakeSandbox()
    sandbox.listedTools = [{ name: "getCalendars", description: "List calendars" }]
    const lifecycleEvents: string[] = []
    const readinessEvents: string[] = []
    const manager = new PluginManager({
      registry: createRegistry(appleEntry),
      createSandbox: () => sandbox,
      emitLifecycleEvent: (event) => {
        lifecycleEvents.push(event.status)
      },
      emitReadinessEvent: (event) => {
        readinessEvents.push(event.readiness)
      },
      prepareRuntime: async () => ({
        readiness: "ready",
        env: {
          MAC_API_BRIDGE_URL: "http://127.0.0.1:53412",
          MAC_API_BRIDGE_TOKEN: "bridge-token",
        },
      }),
    })

    const result = await manager.start("apple-calendar-mcp")

    expect(result).toEqual({
      ok: true,
      pluginId: "apple-calendar-mcp",
      status: "active",
    })
    expect(lifecycleEvents).toEqual(["starting", "ready", "active"])
    expect(readinessEvents).toEqual(["bridge_starting", "ready"])
  })

  test("includes previous readiness and retry class on retry-driven readiness transitions", async () => {
    const sandbox = new FakeSandbox()
    sandbox.listedTools = [{ name: "getCalendars", description: "List calendars" }]
    const readinessEvents: Array<{
      readiness: string
      previousReadiness?: string
      retryClass?: string
    }> = []
    let attempt = 0
    const manager = new PluginManager({
      registry: createRegistry(appleEntry),
      createSandbox: () => sandbox,
      emitReadinessEvent: (event) => {
        readinessEvents.push({
          readiness: event.readiness,
          previousReadiness: event.previousReadiness,
          retryClass: event.retryClass,
        })
      },
      prepareRuntime: async () => {
        attempt += 1
        if (attempt === 1) {
          return {
            readiness: "bridge_unavailable",
            lastError: "Bridge unavailable.",
          }
        }

        return {
          readiness: "ready",
          env: {
            MAC_API_BRIDGE_URL: "http://127.0.0.1:53412",
            MAC_API_BRIDGE_TOKEN: "bridge-token",
          },
        }
      },
    })

    await manager.start("apple-calendar-mcp")
    const result = await manager.retry("apple-calendar-mcp", "retry_bridge_start")

    expect(result).toEqual({
      ok: true,
      pluginId: "apple-calendar-mcp",
      status: "active",
    })
    expect(readinessEvents).toEqual([
      {
        readiness: "bridge_unavailable",
        previousReadiness: undefined,
        retryClass: undefined,
      },
      {
        readiness: "bridge_starting",
        previousReadiness: "bridge_unavailable",
        retryClass: "retry_bridge_start",
      },
      {
        readiness: "ready",
        previousReadiness: "bridge_starting",
        retryClass: "retry_bridge_start",
      },
    ])
  })

  test("captures MCP runtime logs with correlation ids during tool calls", async () => {
    const sandbox = new FakeSandbox()
    sandbox.listedTools = [{ name: "getCalendars", description: "List calendars" }]
    sandbox.callTool = async () => {
      sandbox.emitRuntimeLog("Tool emitted stderr")
      return {
        content: [{ type: "text", text: "ok" }],
        isError: false,
      }
    }
    const runtimeLogs: Array<{
      pluginId: string
      source: string
      message: string
      correlationId?: string
    }> = []
    const manager = new PluginManager({
      registry: createRegistry(appleEntry),
      createSandbox: () => sandbox,
      emitRuntimeLog: (entry) => {
        runtimeLogs.push({
          pluginId: entry.pluginId,
          source: entry.source,
          message: entry.message,
          correlationId: entry.correlationId,
        })
      },
      prepareRuntime: async () => ({
        readiness: "ready",
        env: {
          MAC_API_BRIDGE_URL: "http://127.0.0.1:53412",
          MAC_API_BRIDGE_TOKEN: "bridge-token",
        },
      }),
    })

    await manager.start("apple-calendar-mcp")
    await manager.callTool("apple-calendar-mcp", "getCalendars", {})

    expect(runtimeLogs).toHaveLength(1)
    expect(runtimeLogs[0]).toMatchObject({
      pluginId: "apple-calendar-mcp",
      source: "mcp",
      message: "Tool emitted stderr",
    })
    expect(runtimeLogs[0]?.correlationId).toEqual(expect.any(String))
  })

  test("recomputes Apple Calendar readiness when an enabled runtime is recreated", async () => {
    const userDataPath = createTempDir()
    const enabledStore = new PluginEnabledStore(userDataPath)
    enabledStore.setEnabled("apple-calendar-mcp", true)

    const firstSandbox = new FakeSandbox()
    firstSandbox.listedTools = [{ name: "getCalendars", description: "List calendars" }]
    const secondSandbox = new FakeSandbox()
    secondSandbox.listedTools = [{ name: "getCalendars", description: "List calendars" }]
    let prepareCalls = 0
    let cleanupCalls = 0

    const createManager = (sandbox: FakeSandbox) => new PluginManager({
      registry: createRegistry(appleEntry),
      createSandbox: () => sandbox,
      enabledStore: new PluginEnabledStore(userDataPath),
      prepareRuntime: async () => {
        prepareCalls += 1
        return {
          readiness: "ready",
          env: {
            MAC_API_BRIDGE_URL: `http://127.0.0.1:${53412 + prepareCalls}`,
            MAC_API_BRIDGE_TOKEN: `bridge-token-${prepareCalls}`,
          },
        }
      },
      cleanupRuntime: async () => {
        cleanupCalls += 1
      },
    })

    const firstManager = createManager(firstSandbox)
    await firstManager.autoStartEnabled()
    expect(firstManager.getStatus("apple-calendar-mcp")).toMatchObject({
      kind: "available",
      status: "active",
      readiness: "ready",
    })
    await firstManager.dispose()

    const secondManager = createManager(secondSandbox)
    await secondManager.autoStartEnabled()
    expect(secondManager.getStatus("apple-calendar-mcp")).toMatchObject({
      kind: "available",
      status: "active",
      readiness: "ready",
    })
    await secondManager.dispose()

    expect(prepareCalls).toBe(2)
    expect(cleanupCalls).toBe(2)
    expect(firstSandbox.startCalls).toBe(1)
    expect(secondSandbox.startCalls).toBe(1)
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
