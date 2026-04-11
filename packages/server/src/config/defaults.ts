export const defaultConfig = {
  port: 8787,
  wsHost: "127.0.0.1",
  dbPath: "~/.student-claw/data.db",
  wsHeartbeatInterval: 30000,
  wsMaxPayloadBytes: 256 * 1024,
  allowedOrigins: ["http://localhost:5173", "http://127.0.0.1:5173"],
  isDev: true,
  codexBinaryPath: "codex",
  codexHomePath: undefined,
  codexModel: "gpt-5.4-mini",
  codexRequestTimeoutMs: 45_000,
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
  readonly codexModel: string
  readonly codexRequestTimeoutMs: number
}
