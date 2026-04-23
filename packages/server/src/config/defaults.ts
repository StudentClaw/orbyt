export const defaultConfig = {
  port: 8787,
  wsHost: "127.0.0.1",
  dbPath: "~/.orbyt/data.db",
  wsHeartbeatInterval: 30000,
  wsMaxPayloadBytes: 256 * 1024,
  allowedOrigins: ["http://localhost:5173", "http://127.0.0.1:5173"],
  isDev: true,
  codexBinaryPath: "codex",
  codexHomePath: undefined,
  codexProcessHomePath: undefined,
  codexModel: "gpt-5.4-mini",
  codexRequestTimeoutMs: 45_000,
  pluginGatewayBridgeUrl: undefined,
  pluginGatewayBridgeEventsUrl: undefined,
  pluginGatewayBridgeToken: undefined,
  pluginGatewayMcpUrl: undefined,
  pluginGatewayMcpBearerToken: undefined,
  pluginGatewayMcpServerName: "orbyt",
} as const

export type AppConfig = {
  readonly port: number
  readonly wsHost: string
  readonly wsAuthToken: string
  readonly dbPath: string
  readonly wsHeartbeatInterval: number
  readonly wsMaxPayloadBytes: number
  readonly allowedOrigins: readonly string[]
  readonly isDev: boolean
  readonly codexBinaryPath: string
  readonly codexHomePath?: string
  readonly codexProcessHomePath?: string
  readonly codexModel: string
  readonly codexRequestTimeoutMs: number
  readonly pluginGatewayBridgeUrl?: string
  readonly pluginGatewayBridgeEventsUrl?: string
  readonly pluginGatewayBridgeToken?: string
  readonly pluginGatewayMcpUrl?: string
  readonly pluginGatewayMcpBearerToken?: string
  readonly pluginGatewayMcpServerName: string
}
