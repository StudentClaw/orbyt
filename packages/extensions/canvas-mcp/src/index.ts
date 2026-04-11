import { CanvasCredentialStore, type CanvasCredentialMessage } from "./runtime.js"
import { runCanvasMcpServer } from "./server.js"

const credentialStore = new CanvasCredentialStore()

process.on("message", (message: unknown) => {
  if (!isCanvasCredentialMessage(message)) {
    return
  }

  credentialStore.setCredentials(message.payload)
})

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    process.exit(0)
  })
}

runCanvasMcpServer({ credentialStore }).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[canvas-mcp] ${message}`)
  process.exit(1)
})

function isCanvasCredentialMessage(message: unknown): message is CanvasCredentialMessage {
  if (!message || typeof message !== "object") {
    return false
  }

  const candidate = message as Partial<CanvasCredentialMessage>
  return candidate.type === "plugin.credentials" && candidate.pluginId === "canvas-mcp" && !!candidate.payload
}
