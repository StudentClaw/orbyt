import { Effect, Layer } from "effect"
import { ConfigService, ConfigServiceLive } from "./config/ConfigService.js"
import { Database, DatabaseLive } from "./db/Database.js"
import { WebSocketServerService, WebSocketServerLive } from "./ws/WebSocketServer.js"

const MainLive = Layer.mergeAll(
  ConfigServiceLive,
  WebSocketServerLive,
  DatabaseLive,
).pipe(Layer.provide(ConfigServiceLive))

const program = Effect.gen(function* () {
  const config = yield* ConfigService
  const db = yield* Database
  const ws = yield* WebSocketServerService

  console.log(`Student Claw server started on :${config.port}`)
  console.log(`Database: ${config.dbPath}`)

  const shutdown = () => {
    console.log("\nShutting down...")
    db.close()
    ws.close().then(() => {
      console.log("Server stopped.")
      process.exit(0)
    })
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
})

Effect.runPromise(
  program.pipe(Effect.provide(MainLive))
).catch((err) => {
  console.error("Failed to start server:", err)
  process.exit(1)
})
