import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs"
import path from "node:path"
import { resolveOrbytHome } from "../server/orbyt-home.js"

export type CanvasCredentialsValues = {
  readonly baseUrl: string
  readonly token: string
}

const FILENAME = "canvas-credentials.json"

function canvasCredentialsPath(orbytHome = resolveOrbytHome()): string {
  return path.join(orbytHome, FILENAME)
}

/**
 * Writes Canvas credentials to a file the server reads at request time.
 * Lets users save credentials in-app without restarting the server.
 *
 * Mode 0600 keeps the token readable only by the user.
 */
export function writeCanvasCredentialsFile(values: CanvasCredentialsValues): void {
  const orbytHome = resolveOrbytHome()
  mkdirSync(orbytHome, { recursive: true })
  const filePath = canvasCredentialsPath(orbytHome)
  writeFileSync(
    filePath,
    JSON.stringify({ baseUrl: values.baseUrl, token: values.token }, null, 2),
    { mode: 0o600 },
  )
}

export function clearCanvasCredentialsFile(): void {
  const filePath = canvasCredentialsPath()
  if (!existsSync(filePath)) return
  try {
    unlinkSync(filePath)
  } catch {
    // best-effort: server will fall back to env vars or treat as not configured
  }
}
