import { Context, Layer, Effect } from "effect"
import { type AppConfig, defaultConfig } from "./defaults.js"

export class ConfigService extends Context.Tag("ConfigService")<
  ConfigService,
  AppConfig
>() {}

export const ConfigServiceLive = Layer.effect(
  ConfigService,
  Effect.sync(() => {
    const port = process.env.PORT ? Number(process.env.PORT) : defaultConfig.port
    const dbPath = process.env.DB_PATH ?? defaultConfig.dbPath
    const isDev = process.env.NODE_ENV !== "production"

    if (isNaN(port) || port < 0 || port > 65535) {
      throw new Error(`Invalid port: ${process.env.PORT}`)
    }

    return {
      port,
      dbPath,
      wsHeartbeatInterval: defaultConfig.wsHeartbeatInterval,
      isDev,
    }
  }),
)
