export const defaultConfig = {
  port: 8787,
  dbPath: "~/.student-claw/data.db",
  wsHeartbeatInterval: 30000,
  isDev: true,
  codexBinaryPath: "codex",
  codexHomePath: undefined,
  codexModel: "gpt-5.4-mini",
  codexRequestTimeoutMs: 45_000,
} as const

export type AppConfig = {
  readonly port: number
  readonly dbPath: string
  readonly wsHeartbeatInterval: number
  readonly isDev: boolean
  readonly codexBinaryPath: string
  readonly codexHomePath?: string
  readonly codexModel: string
  readonly codexRequestTimeoutMs: number
}
