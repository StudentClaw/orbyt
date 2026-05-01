import { Context, Effect, Layer } from "effect"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { CanvasAuthError } from "@orbyt/contracts"
import { CanvasApiClient, type CanvasApiDependencies } from "./CanvasApiClient.js"
import type { CanvasCredentials } from "./lib/canvas-client.js"

export type CanvasApiService = CanvasApiClient

export class CanvasApi extends Context.Tag("CanvasApi")<CanvasApi, CanvasApiService>() {}

const CREDENTIALS_FILENAME = "canvas-credentials.json"

function readCredentialsFromFile(): CanvasCredentials | null {
  const home = process.env.ORBYT_HOME?.trim()
  if (!home) return null
  const filePath = path.join(home, CREDENTIALS_FILENAME)
  if (!existsSync(filePath)) return null
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
      baseUrl?: unknown
      token?: unknown
    }
    if (typeof parsed.baseUrl !== "string" || typeof parsed.token !== "string") {
      return null
    }
    const baseUrl = parsed.baseUrl.trim()
    const token = parsed.token.trim()
    if (!baseUrl || !token) return null
    return { baseUrl, token }
  } catch {
    return null
  }
}

/**
 * Resolves Canvas credentials, preferring a hot-reloadable file under
 * $ORBYT_HOME so the user can save tokens in the UI without restarting the
 * server. Falls back to CANVAS_BASE_URL / CANVAS_TOKEN env vars (used by
 * tests and headless deployments). Re-reads on every call so token rotation
 * takes effect on the next sync.
 */
function readCredentials(): CanvasCredentials {
  const fromFile = readCredentialsFromFile()
  if (fromFile) return fromFile

  const baseUrl = process.env.CANVAS_BASE_URL?.trim() ?? ""
  const token = process.env.CANVAS_TOKEN?.trim() ?? ""
  if (!baseUrl || !token) {
    throw new CanvasAuthError({
      message:
        "Canvas credentials not configured. Save your Canvas URL and access token in Settings → Plugins.",
    })
  }
  return { baseUrl, token }
}

export function createCanvasApiClient(
  overrides?: Partial<CanvasApiDependencies>,
): CanvasApiClient {
  const deps: CanvasApiDependencies = {
    now: overrides?.now ?? (() => new Date()),
    getCredentials: overrides?.getCredentials ?? readCredentials,
    createClient: overrides?.createClient,
    workspaceRoot: overrides?.workspaceRoot,
    writableRoots: overrides?.writableRoots,
  }
  return new CanvasApiClient(deps)
}

export const CanvasApiLive = Layer.effect(
  CanvasApi,
  Effect.sync(() => createCanvasApiClient()),
)
