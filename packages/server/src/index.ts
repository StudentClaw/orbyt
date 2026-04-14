import { Effect, Layer } from "effect"
import { CodexCli, CodexCliLive } from "./ai/CodexCli.js"
import { ProviderRuntimeStoreLive } from "./ai/ProviderRuntimeStore.js"
import { ConfigService, ConfigServiceLive } from "./config/ConfigService.js"
import { Database, DatabaseLive } from "./db/Database.js"
import { PluginGatewayLive } from "./mcp/PluginGateway.js"
import { OrchestrationService, OrchestrationServiceLive } from "./orchestration/OrchestrationService.js"
import { RuntimeReceiptBusLive } from "./orchestration/RuntimeReceiptBus.js"
import { ServerReadiness, ServerReadinessLive } from "./runtime/ServerReadiness.js"
import { SkillResolverLive } from "./skills/index.js"
import { PushBusLive } from "./ws/PushBus.js"
import { WebSocketServerService, WebSocketServerLive } from "./ws/WebSocketServer.js"

const CoreLive = Layer.mergeAll(
  ConfigServiceLive,
  DatabaseLive.pipe(Layer.provide(ConfigServiceLive)),
  ServerReadinessLive,
  PushBusLive,
  RuntimeReceiptBusLive,
  SkillResolverLive,
)

const RuntimeStoreLive = ProviderRuntimeStoreLive.pipe(Layer.provideMerge(CoreLive))
const GatewayLive = PluginGatewayLive.pipe(Layer.provideMerge(CoreLive))

const ProviderLive = Layer.mergeAll(
  RuntimeStoreLive,
  GatewayLive,
  CodexCliLive.pipe(
    Layer.provideMerge(CoreLive),
    Layer.provideMerge(RuntimeStoreLive),
    Layer.provideMerge(GatewayLive),
  ),
)

const OrchestrationLive = OrchestrationServiceLive.pipe(
  Layer.provideMerge(ProviderLive),
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
  const codex = yield* CodexCli
  const ws = yield* WebSocketServerService

  readiness.markReady()

  writeStdout(`Student Claw server started on :${config.port}`)
  writeStdout(`Database: ${config.dbPath}`)

  const shutdown = () => {
    writeStdout("")
    writeStdout("Shutting down...")
    codex.shutdown()
      .catch(() => undefined)
      .finally(() => {
        db.close()
        ws.close().then(() => {
          writeStdout("Server stopped.")
          process.exit(0)
        })
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
