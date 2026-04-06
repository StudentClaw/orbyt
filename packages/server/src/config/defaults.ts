export const defaultConfig = {
  port: 8787,
  dbPath: "~/.student-claw/data.db",
  wsHeartbeatInterval: 30000,
  isDev: true,
} as const

export type AppConfig = {
  readonly port: number
  readonly dbPath: string
  readonly wsHeartbeatInterval: number
  readonly isDev: boolean
}
