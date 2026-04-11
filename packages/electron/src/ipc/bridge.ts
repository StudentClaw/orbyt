import {
  BrowserWindow,
  dialog,
  ipcMain,
  app,
  Notification,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from "electron"
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import type { DesktopBootstrap, CodexAuthResult } from "@student-claw/contracts"
import { IPC_CHANNELS } from "./channels.js"

const currentDir = path.dirname(fileURLToPath(import.meta.url))

function resolveCodexPath(): string {
  const candidates = [
    // Bundled binary (production)
    path.join(currentDir, "../../resources/codex"),
    path.join(currentDir, "../../../resources/codex"),
    // Local node_modules (dev)
    path.join(currentDir, "../../node_modules/.bin/codex"),
    path.join(currentDir, "../../../node_modules/.bin/codex"),
    path.join(currentDir, "../../../../node_modules/.bin/codex"),
  ]
  return candidates.find(existsSync) ?? "codex"
}

/**
 * Registers the Electron main-process IPC handlers needed by the renderer runtime.
 */
export function registerIpcHandlers(bootstrap: DesktopBootstrap): void {
  ipcMain.handle(IPC_CHANNELS.APP_GET_PATH, (_event, name: string) => {
    return app.getPath(name as Parameters<typeof app.getPath>[0])
  })

  ipcMain.handle(IPC_CHANNELS.APP_GET_BOOTSTRAP, () => {
    return bootstrap
  })

  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_SHOW, (_event, options: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: options.title,
        body: options.body,
      })
      notification.show()
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.FILE_OPEN_DIALOG,
    async (
      _event,
      options?: {
        filters?: Array<{ name: string; extensions: string[] }>
        directory?: boolean
      },
    ): Promise<string | null> => {
      const window = BrowserWindow.getFocusedWindow()
      const dialogOptions: OpenDialogOptions = {
        properties: options?.directory ? ["openDirectory"] : ["openFile"],
        filters: options?.filters,
      }
      const result = window
        ? await dialog.showOpenDialog(window, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)
      if (result.canceled) {
        return null
      }

      return result.filePaths[0] ?? null
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.FILE_SAVE_DIALOG,
    async (
      _event,
      options?: {
        defaultPath?: string
      },
    ): Promise<string | null> => {
      const window = BrowserWindow.getFocusedWindow()
      const dialogOptions: SaveDialogOptions = {
        defaultPath: options?.defaultPath,
      }
      const result = window
        ? await dialog.showSaveDialog(window, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions)
      return result.canceled ? null : (result.filePath ?? null)
    },
  )

  ipcMain.handle(IPC_CHANNELS.CODEX_AUTH_START, (): Promise<CodexAuthResult> => {
    const codexPath = resolveCodexPath()

    return new Promise((resolve) => {
      const proc = spawn(codexPath, ["login"], { stdio: "pipe" })
      const OAUTH_TIMEOUT_MS = 120_000

      const timer = setTimeout(() => {
        proc.kill()
        resolve({ status: "failed", error: "OAuth timed out" })
      }, OAUTH_TIMEOUT_MS)

      proc.on("exit", (code) => {
        clearTimeout(timer)
        if (code === 0) {
          resolve({ status: "connected" })
        } else {
          resolve({ status: "failed", error: "Codex login failed" })
        }
      })

      proc.on("error", (err) => {
        clearTimeout(timer)
        const message = (err as NodeJS.ErrnoException).code === "ENOENT"
          ? "Codex CLI not found. Install it with: npm install -g @openai/codex"
          : err.message
        resolve({ status: "failed", error: message })
      })
    })
  })
}
