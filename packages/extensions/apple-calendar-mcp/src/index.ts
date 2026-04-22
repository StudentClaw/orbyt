import { runAppleCalendarMcpServer } from "./server.js"

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    process.exit(0)
  })
}

runAppleCalendarMcpServer().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[apple-calendar-mcp] ${message}`)
  process.exit(1)
})
