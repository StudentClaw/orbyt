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
    }))

    const { registerIpcHandlers } = await import(`../ipc/bridge.js?test=${Date.now()}`)
    registerIpcHandlers(bootstrap)

    const listHandler = handlers.get(IpcChannel.PLUGIN_LIST)
    const statusHandler = handlers.get(IpcChannel.PLUGIN_GET_STATUS)
    expect(listHandler).toBeDefined()
    expect(statusHandler).toBeDefined()

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
  })
})
