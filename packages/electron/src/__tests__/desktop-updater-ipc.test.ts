import { afterEach, describe, expect, mock, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { IpcChannel } from "@orbyt/contracts"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-updater-ipc-"))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  mock.restore()
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe("desktop updater IPC", () => {
  test("registers state and mode handlers while updates are disabled in dev", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const userDataRoot = createTempDir()
    const updater = {
      channel: "",
      allowPrerelease: true,
      allowDowngrade: true,
      autoDownload: true,
      autoInstallOnAppQuit: false,
    }

    mock.module("electron", () => ({
      app: {
        isPackaged: false,
        getVersion: () => "0.1.0",
        getPath: (name: string) => name === "userData" ? userDataRoot : "/tmp",
        getAppPath: () => "/tmp",
      },
      BrowserWindow: {
        getAllWindows: () => [],
      },
      ipcMain: {
        removeHandler: () => undefined,
        handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
          handlers.set(channel, handler)
        },
      },
    }))
    mock.module("electron-updater", () => ({
      default: { autoUpdater: updater },
      autoUpdater: updater,
    }))

    const { registerStableAutoUpdates, stopStableAutoUpdates } = await import(`../updater/desktop-updater.js?ipc=${Date.now()}`)
    registerStableAutoUpdates()

    const stateHandler = handlers.get(IpcChannel.APP_UPDATE_GET_STATE)
    const modeHandler = handlers.get(IpcChannel.APP_UPDATE_SET_MODE)
    expect(stateHandler).toBeDefined()
    expect(modeHandler).toBeDefined()
    expect(await stateHandler?.({})).toMatchObject({
      enabled: false,
      mode: "automatic",
      status: "disabled",
    })

    expect(await modeHandler?.({}, { mode: "prompt" })).toMatchObject({
      state: {
        enabled: false,
        mode: "prompt",
        status: "disabled",
      },
    })
    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)

    stopStableAutoUpdates()
  })
})
