import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { Context, Layer, Effect } from "effect"
import { type AppConfig, defaultConfig } from "./defaults.js"

const AUTH_TOKEN_PATTERN = /^[a-f0-9]{64}$/i

/**
 * Effect service tag that provides the validated server runtime configuration.
 */
export class ConfigService extends Context.Tag("ConfigService")<
  ConfigService,
  AppConfig
>() {}

type CodexBinaryPathResolverInput = {
  readonly env?: NodeJS.ProcessEnv
  readonly platform?: NodeJS.Platform
  readonly hasPath?: (path: string) => boolean
}

function resolveLocalCodexBin(hasPath: (p: string) => boolean): string | undefined {
  // Walk up from this module's directory looking for node_modules/.bin/codex.
  // Works in both dev (src/) and built (dist/) layouts, and handles bun workspace
  // hoisting where the binary lands at the workspace root's node_modules.
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "node_modules", ".bin", "codex")
    if (hasPath(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return undefined
}

export function resolveCodexBinaryPath(
  input: CodexBinaryPathResolverInput = {},
): string {
  const env = input.env ?? process.env
  const platform = input.platform ?? process.platform
  const hasPath = input.hasPath ?? existsSync
  const configuredPath = env.CODEX_BINARY_PATH?.trim()

  if (configuredPath) {
    return configuredPath
  }

  const platformCandidates = platform === "darwin"
    ? ["/Applications/Codex.app/Contents/Resources/codex"]
    : []

  return (
    platformCandidates.find((candidate) => hasPath(candidate))
    ?? resolveLocalCodexBin(hasPath)
    ?? defaultConfig.codexBinaryPath
  )
}

/**
 * Loads runtime configuration from the environment and enforces the secure WS auth contract.
 */
export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.sync(() => {
    const port = process.env.PORT ? Number(process.env.PORT) : defaultConfig.port
    const dbPath = process.env.DB_PATH ?? defaultConfig.dbPath
    const wsAuthToken = process.env.WS_AUTH_TOKEN
    const isDev = process.env.NODE_ENV !== "production"
    const codexRequestTimeoutMs = process.env.CODEX_REQUEST_TIMEOUT_MS
      ? Number(process.env.CODEX_REQUEST_TIMEOUT_MS)
      : defaultConfig.codexRequestTimeoutMs

    if (isNaN(port) || port < 0 || port > 65535) {
      throw new Error(`Invalid port: ${process.env.PORT}`)
    }
    if (!wsAuthToken || !AUTH_TOKEN_PATTERN.test(wsAuthToken)) {
      throw new Error("WS_AUTH_TOKEN must be a 64-character hex string")
    }

    if (isNaN(codexRequestTimeoutMs) || codexRequestTimeoutMs <= 0) {
      throw new Error(`Invalid Codex request timeout: ${process.env.CODEX_REQUEST_TIMEOUT_MS}`)
    }

    return {
      port,
      wsHost: defaultConfig.wsHost,
      wsAuthToken,
      dbPath,
      wsHeartbeatInterval: defaultConfig.wsHeartbeatInterval,
      wsMaxPayloadBytes: defaultConfig.wsMaxPayloadBytes,
      allowedOrigins: defaultConfig.allowedOrigins,
      isDev,
      codexBinaryPath: resolveCodexBinaryPath(),
      codexHomePath: process.env.CODEX_HOME_PATH ?? defaultConfig.codexHomePath,
      codexProcessHomePath: process.env.CODEX_PROCESS_HOME_PATH ?? defaultConfig.codexProcessHomePath,
      codexModel: process.env.CODEX_MODEL ?? defaultConfig.codexModel,
      codexRequestTimeoutMs,
      pluginGatewayBridgeUrl: process.env.PLUGIN_GATEWAY_BRIDGE_URL ?? defaultConfig.pluginGatewayBridgeUrl,
      pluginGatewayBridgeEventsUrl: process.env.PLUGIN_GATEWAY_BRIDGE_EVENTS_URL ?? defaultConfig.pluginGatewayBridgeEventsUrl,
      pluginGatewayBridgeToken: process.env.PLUGIN_GATEWAY_BRIDGE_TOKEN ?? defaultConfig.pluginGatewayBridgeToken,
      pluginGatewayMcpUrl: process.env.PLUGIN_GATEWAY_MCP_URL ?? defaultConfig.pluginGatewayMcpUrl,
      pluginGatewayMcpBearerToken: process.env.PLUGIN_GATEWAY_MCP_BEARER_TOKEN ?? defaultConfig.pluginGatewayMcpBearerToken,
      pluginGatewayMcpServerName: process.env.PLUGIN_GATEWAY_MCP_SERVER_NAME ?? defaultConfig.pluginGatewayMcpServerName,
    }
  }),
)
