import { Effect, Layer } from "effect"
import { ConfigService, ConfigServiceLive } from "./config/ConfigService.js"
import { Database, DatabaseLive } from "./db/Database.js"
import { OrchestrationService, OrchestrationServiceLive } from "./orchestration/OrchestrationService.js"
import { RuntimeReceiptBusLive } from "./orchestration/RuntimeReceiptBus.js"
import { ServerReadiness, ServerReadinessLive } from "./runtime/ServerReadiness.js"
import { PushBusLive } from "./ws/PushBus.js"
import { WebSocketServerService, WebSocketServerLive } from "./ws/WebSocketServer.js"

const CoreLive = Layer.mergeAll(
  ConfigServiceLive,
  DatabaseLive.pipe(Layer.provide(ConfigServiceLive)),
  ServerReadinessLive,
  PushBusLive,
  RuntimeReceiptBusLive,
)

const OrchestrationLive = OrchestrationServiceLive.pipe(
  Layer.provideMerge(CoreLive),
)

const WebSocketLive = WebSocketServerLive.pipe(
  Layer.provideMerge(OrchestrationLive),
  Layer.provideMerge(CoreLive),
)

const MainLive = Layer.mergeAll(
  CoreLive,
  OrchestrationLive,
  WebSocketLive,
)

function writeStdout(message: string): void {
  process.stdout.write(`${message}\n`)
}

function writeStderr(message: string): void {
  process.stderr.write(`${message}\n`)
}

const program = Effect.gen(function* () {
  const config = yield* ConfigService
  const db = yield* Database
  const readiness = yield* ServerReadiness
  yield* OrchestrationService
  const ws = yield* WebSocketServerService

  readiness.markReady()

  writeStdout(`Student Claw server started on :${config.port}`)
  writeStdout(`Database: ${config.dbPath}`)

  const shutdown = () => {
    writeStdout("")
    writeStdout("Shutting down...")
    db.close()
    ws.close().then(() => {
      writeStdout("Server stopped.")
      process.exit(0)
    })
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
})

Effect.runPromise(
  program.pipe(Effect.provide(MainLive))
).catch((err) => {
  writeStderr(`Failed to start server: ${String(err)}`)
  process.exit(1)
})
