import { Context, Effect, Layer } from "effect"
import { CanvasAuthError } from "@orbyt/contracts"
import { CanvasApiClient, type CanvasApiDependencies } from "./CanvasApiClient.js"
import type { CanvasCredentials } from "./lib/canvas-client.js"

export type CanvasApiService = CanvasApiClient

export class CanvasApi extends Context.Tag("CanvasApi")<CanvasApi, CanvasApiService>() {}

/**
 * Resolves Canvas credentials from environment variables. Electron sets
 * CANVAS_BASE_URL and CANVAS_TOKEN when spawning the server process so the
 * server can hit the Canvas REST API directly without going through an MCP
 * plugin. If unset, every Canvas method throws CanvasAuthError until the
 * user saves credentials in the UI and the server restarts.
 *
 * Future work: read from a hot-reloadable source (e.g., a JSON file under
 * $ORBYT_HOME) so token rotation doesn't need a server restart.
 */
function readCredentialsFromEnv(): CanvasCredentials {
  const baseUrl = process.env.CANVAS_BASE_URL?.trim() ?? ""
  const token = process.env.CANVAS_TOKEN?.trim() ?? ""
  if (!baseUrl || !token) {
    throw new CanvasAuthError({
      message:
        "Canvas credentials not configured. Set CANVAS_BASE_URL and CANVAS_TOKEN, or save them in the app and restart the server.",
    })
  }
  return { baseUrl, token }
}

export function createCanvasApiClient(
  overrides?: Partial<CanvasApiDependencies>,
): CanvasApiClient {
  const deps: CanvasApiDependencies = {
    now: overrides?.now ?? (() => new Date()),
    getCredentials: overrides?.getCredentials ?? readCredentialsFromEnv,
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
