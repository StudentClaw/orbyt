import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"
import { IpcChannel, type DesktopBootstrap } from "@student-claw/contracts"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "student-claw-bridge-plugin-ipc-"))
  tempDirs.push(dir)
  return dir
}

function writeManifest(rootDir: string, folderName: string, manifest: object): void {
  const extensionDir = path.join(rootDir, folderName)
  mkdirSync(extensionDir, { recursive: true })
  writeFileSync(path.join(extensionDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8")
}

describe("registerIpcHandlers plugin reads", () => {
  const bootstrap: DesktopBootstrap = {
    wsUrl: "ws://127.0.0.1:8787",
    wsAuthToken: "a".repeat(64),
    appVersion: "0.1.0",
    platform: "darwin",
    featureFlags: {
      pluginSystem: true,
    },
  }

  let resourcesPathBefore: string | undefined

  beforeEach(() => {
    resourcesPathBefore = process.resourcesPath
  })

  afterEach(() => {
    mock.restore()

    if (resourcesPathBefore) {
      process.resourcesPath = resourcesPathBefore
    }

    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (dir) {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  test("returns registry items through plugin:list and plugin:get-status", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const resourcesRoot = createTempDir()
    const userDataRoot = createTempDir()

    writeManifest(path.join(resourcesRoot, "extensions"), "template-mcp", {
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
    })

    process.resourcesPath = resourcesRoot

    mock.module("electron", () => ({
      BrowserWindow: {
        getFocusedWindow: () => null,
      },
      dialog: {
        showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
        showSaveDialog: async () => ({ canceled: true, filePath: null }),
      },
      ipcMain: {
        removeHandler: () => undefined,
        handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
          handlers.set(channel, handler)
        },
      },
      app: {
        isPackaged: true,
        getPath: (name: string) => {
          if (name === "userData") {
            return userDataRoot
          }
          return "/tmp"
        },
      },
      Notification: class {
        static isSupported(): boolean {
          return false
        }
      },
      powerMonitor: {
        on: () => undefined,
        removeListener: () => undefined,
      },
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value: string) => Buffer.from(`enc:${value}`, "utf8"),
        decryptString: (value: Buffer) => value.toString("utf8").replace(/^enc:/, ""),
      },
    }))

    const { registerIpcHandlers } = await import(`../ipc/bridge.js?test=${Date.now()}`)
    registerIpcHandlers(bootstrap)

    const listHandler = handlers.get(IpcChannel.PLUGIN_LIST)
    const statusHandler = handlers.get(IpcChannel.PLUGIN_GET_STATUS)
    const pushSettingsHandler = handlers.get(IpcChannel.PUSH_GET_SETTINGS)
    expect(listHandler).toBeDefined()
    expect(statusHandler).toBeDefined()
    expect(pushSettingsHandler).toBeDefined()

    const listResult = await listHandler?.({}, {})
    expect(listResult).toHaveLength(1)
    expect(listResult?.[0]).toMatchObject({
      kind: "available",
      installSource: "bundled",
      status: "discovered",
    })

    const statusResult = await statusHandler?.({}, { pluginId: "template-mcp" })
    expect(statusResult).toMatchObject({
      kind: "available",
      installSource: "bundled",
    })

    expect(await pushSettingsHandler?.({})).toMatchObject({
      enabled: true,
      linkedDevice: null,
      activePairing: null,
    })
  })

  test("saves and reads plugin auth status through IPC", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const resourcesRoot = createTempDir()
    const userDataRoot = createTempDir()

    writeManifest(path.join(resourcesRoot, "extensions"), "canvas-mcp", {
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
    })

    process.resourcesPath = resourcesRoot

    mock.module("electron", () => ({
      BrowserWindow: {
        getFocusedWindow: () => null,
        getAllWindows: () => [],
      },
      dialog: {
        showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
        showSaveDialog: async () => ({ canceled: true, filePath: null }),
      },
      ipcMain: {
        removeHandler: () => undefined,
        handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
          handlers.set(channel, handler)
        },
      },
      app: {
        isPackaged: true,
        getPath: (name: string) => {
          if (name === "userData") {
            return userDataRoot
          }
          return "/tmp"
        },
      },
      Notification: class {
        static isSupported(): boolean {
          return false
        }
      },
      powerMonitor: {
        on: () => undefined,
        removeListener: () => undefined,
      },
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value: string) => Buffer.from(`enc:${value}`, "utf8"),
        decryptString: (value: Buffer) => value.toString("utf8").replace(/^enc:/, ""),
      },
    }))

    const { registerIpcHandlers } = await import(`../ipc/bridge.js?auth-test=${Date.now()}`)
    registerIpcHandlers(bootstrap)

    const getAuthHandler = handlers.get(IpcChannel.PLUGIN_GET_AUTH_STATUS)
    const saveAuthHandler = handlers.get(IpcChannel.PLUGIN_SAVE_AUTH)
    expect(getAuthHandler).toBeDefined()
    expect(saveAuthHandler).toBeDefined()

    const before = await getAuthHandler?.({}, { pluginId: "canvas-mcp" })
    expect(before).toEqual({
      pluginId: "canvas-mcp",
      status: "not_configured",
    })

    const saved = await saveAuthHandler?.({}, {
      pluginId: "canvas-mcp",
      values: {
        baseUrl: "https://myschool.instructure.com",
        token: "12345678901234567890",
      },
    })
    expect(saved).toEqual({
      ok: true,
      pluginId: "canvas-mcp",
      status: "configured",
    })

    const after = await getAuthHandler?.({}, { pluginId: "canvas-mcp" })
    expect(after).toEqual({
      pluginId: "canvas-mcp",
      status: "configured",
    })
  })

  test("runs Codex login inside the app-isolated Codex home", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const userDataRoot = createTempDir()
    let spawnOptions: Record<string, unknown> | null = null

    mock.module("node:child_process", () => ({
      spawn: (_command: string, _args: string[], options: Record<string, unknown>) => {
        spawnOptions = options
        return {
          kill: () => undefined,
          on: (event: string, callback: (...args: unknown[]) => void) => {
            if (event === "exit") {
              queueMicrotask(() => callback(0))
            }
            return undefined
          },
        }
      },
    }))

    mock.module("electron", () => ({
      BrowserWindow: {
        getFocusedWindow: () => null,
        getAllWindows: () => [],
      },
      dialog: {
        showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
        showSaveDialog: async () => ({ canceled: true, filePath: null }),
      },
      ipcMain: {
        removeHandler: () => undefined,
        handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
          handlers.set(channel, handler)
        },
      },
      app: {
        isPackaged: true,
        getPath: (name: string) => {
          if (name === "userData") {
            return userDataRoot
          }
          return "/tmp"
        },
      },
      Notification: class {
        static isSupported(): boolean {
          return false
        }
      },
      powerMonitor: {
        on: () => undefined,
        removeListener: () => undefined,
      },
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value: string) => Buffer.from(`enc:${value}`, "utf8"),
        decryptString: (value: Buffer) => value.toString("utf8").replace(/^enc:/, ""),
      },
    }))

    const { registerIpcHandlers } = await import(`../ipc/bridge.js?codex-auth-test=${Date.now()}`)
    registerIpcHandlers(bootstrap)

    const authHandler = handlers.get(IpcChannel.CODEX_AUTH_START)
    expect(authHandler).toBeDefined()

    const result = await authHandler?.()
    expect(result).toEqual({ status: "connected" })
    expect(spawnOptions).not.toBeNull()
    expect((spawnOptions?.env as Record<string, string>).CODEX_HOME).toBe(path.join(userDataRoot, "codex-home"))
    expect((spawnOptions?.env as Record<string, string>).HOME).toBe(path.join(userDataRoot, "codex-user-home"))
  })

  test("registers phone push IPC handlers when a push manager is provided", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const userDataRoot = createTempDir()
    const pushManager = {
      start: async () => undefined,
      stop: () => undefined,
      getSettings: () => ({
        enabled: true,
        workflowEventsEnabled: true,
        weeklyInsightsEnabled: true,
        quietHoursStart: "22:00",
        quietHoursEnd: "08:00",
        weeklyInsightsDay: 1,
        weeklyInsightsTime: "08:00",
        relayBaseUrl: "https://push.example.com",
        linkedDevice: null,
        activePairing: null,
      }),
      updateSettings: () => ({
        enabled: false,
        workflowEventsEnabled: true,
        weeklyInsightsEnabled: true,
        quietHoursStart: "22:00",
        quietHoursEnd: "08:00",
        weeklyInsightsDay: 1,
        weeklyInsightsTime: "08:00",
        relayBaseUrl: "https://push.example.com",
        linkedDevice: null,
        activePairing: null,
      }),
      startPairing: async () => ({
        sessionId: "session_1",
        qrUrl: "https://push.example.com/pair/session_1",
        expiresAt: "2026-04-15T13:00:00.000Z",
        state: "pending" as const,
      }),
      getPairingStatus: async () => ({
        linkedDevice: null,
        activePairing: null,
      }),
      cancelPairing: async () => ({
        enabled: true,
        workflowEventsEnabled: true,
        weeklyInsightsEnabled: true,
        quietHoursStart: "22:00",
        quietHoursEnd: "08:00",
        weeklyInsightsDay: 1,
        weeklyInsightsTime: "08:00",
        relayBaseUrl: "https://push.example.com",
        linkedDevice: null,
        activePairing: null,
      }),
      sendTest: async () => ({ ok: true }),
      unlinkDevice: () => ({
        enabled: true,
        workflowEventsEnabled: true,
        weeklyInsightsEnabled: true,
        quietHoursStart: "22:00",
        quietHoursEnd: "08:00",
        weeklyInsightsDay: 1,
        weeklyInsightsTime: "08:00",
        relayBaseUrl: "https://push.example.com",
        linkedDevice: null,
        activePairing: null,
      }),
    }

    mock.module("electron", () => ({
      BrowserWindow: {
        getFocusedWindow: () => null,
        getAllWindows: () => [],
      },
      dialog: {
        showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
        showSaveDialog: async () => ({ canceled: true, filePath: null }),
      },
      ipcMain: {
        removeHandler: () => undefined,
        handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
          handlers.set(channel, handler)
        },
      },
      app: {
        isPackaged: true,
        getPath: (name: string) => {
          if (name === "userData") {
            return userDataRoot
          }
          return "/tmp"
        },
      },
      Notification: class {
        static isSupported(): boolean {
          return false
        }
      },
      powerMonitor: {
        on: () => undefined,
        removeListener: () => undefined,
      },
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value: string) => Buffer.from(`enc:${value}`, "utf8"),
        decryptString: (value: Buffer) => value.toString("utf8").replace(/^enc:/, ""),
      },
    }))

    const { registerIpcHandlers } = await import(`../ipc/bridge.js?push-ipc-test=${Date.now()}`)
    registerIpcHandlers(bootstrap, {
      pluginManager: {
        list: () => [],
        start: async () => ({ ok: false, pluginId: "ignored", reason: "plugin_system_disabled" }),
        stop: async () => ({ ok: false, pluginId: "ignored", reason: "plugin_system_disabled" }),
        retry: async () => ({ ok: false, pluginId: "ignored", reason: "plugin_system_disabled" }),
        getStatus: () => null,
        dispose: async () => undefined,
      } as never,
      pluginAuthService: {
        getStatus: () => null,
        saveCredentials: () => ({
          ok: false,
          pluginId: "ignored",
          reason: "plugin_system_disabled",
          error: "disabled",
        }),
      } as never,
      pushManager: pushManager as never,
    })

    const getSettings = handlers.get(IpcChannel.PUSH_GET_SETTINGS)
    const startPairing = handlers.get(IpcChannel.PUSH_START_PAIRING)
    const sendTest = handlers.get(IpcChannel.PUSH_SEND_TEST)

    expect(getSettings).toBeDefined()
    expect(startPairing).toBeDefined()
    expect(sendTest).toBeDefined()
    expect(await getSettings?.({})).toMatchObject({
      enabled: true,
      relayBaseUrl: "https://push.example.com",
    })
    expect(await startPairing?.({})).toMatchObject({
      sessionId: "session_1",
      state: "pending",
    })
    expect(await sendTest?.({})).toEqual({ ok: true })
  })
})
