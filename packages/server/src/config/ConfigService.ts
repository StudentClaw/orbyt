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

    if (isNaN(port) || port < 0 || port > 65535) {
      throw new Error(`Invalid port: ${process.env.PORT}`)
    }
    if (!wsAuthToken || !AUTH_TOKEN_PATTERN.test(wsAuthToken)) {
      throw new Error("WS_AUTH_TOKEN must be a 64-character hex string")
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
    }
  }),
)
