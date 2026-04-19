import { Effect, Layer } from "effect"
import { CodexCli, CodexCliLive } from "./ai/CodexCli.js"
import { ProviderRuntimeStoreLive } from "./ai/ProviderRuntimeStore.js"
import { ConfigService, ConfigServiceLive } from "./config/ConfigService.js"
import { Database, DatabaseLive } from "./db/Database.js"
import { PluginGatewayLive } from "./mcp/PluginGateway.js"
import { OrchestrationService, OrchestrationServiceLive } from "./orchestration/OrchestrationService.js"
import { RuntimeReceiptBusLive } from "./orchestration/RuntimeReceiptBus.js"
import { ThreadRuntimeManager, ThreadRuntimeManagerLive } from "./orchestration/ThreadRuntimeManager.js"
import { ServerReadiness, ServerReadinessLive } from "./runtime/ServerReadiness.js"
import { SkillResolverLive } from "./skills/index.js"
import { PushBusLive } from "./ws/PushBus.js"
import { WebSocketServerService, WebSocketServerLive } from "./ws/WebSocketServer.js"
import { CanvasSyncService, CanvasSyncServiceLive } from "./canvas/CanvasSyncService.js"

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
  ThreadRuntimeManagerLive.pipe(
    Layer.provideMerge(CoreLive),
    Layer.provideMerge(RuntimeStoreLive),
    Layer.provideMerge(GatewayLive),
  ),
)

const OrchestrationLive = OrchestrationServiceLive.pipe(
  Layer.provideMerge(ProviderLive),
  Layer.provideMerge(CoreLive),
)

const CanvasSyncLive = CanvasSyncServiceLive.pipe(
  Layer.provideMerge(GatewayLive),
  Layer.provideMerge(CoreLive),
)

const WebSocketLive = WebSocketServerLive.pipe(
  Layer.provideMerge(OrchestrationLive),
  Layer.provideMerge(CanvasSyncLive),
  Layer.provideMerge(CoreLive),
)

const MainLive = Layer.mergeAll(
  CoreLive,
  OrchestrationLive,
  CanvasSyncLive,
  WebSocketLive,
)

function writeStdout(message: string): void {
  process.stdout.write(`${message}\n`)
}

function writeStderr(message: string): void {
  process.stderr.write(`${message}\n`)
}

const ONE_HOUR_MS = 60 * 60 * 1000

const program = Effect.gen(function* () {
  const config = yield* ConfigService
  const db = yield* Database
  const readiness = yield* ServerReadiness
  const orchestration = yield* OrchestrationService
  const codex = yield* CodexCli
  const threadRuntimeManager = yield* ThreadRuntimeManager
  const ws = yield* WebSocketServerService
  const canvasSync = yield* CanvasSyncService

  readiness.markReady()

  writeStdout(`Student Claw server started on :${config.port}`)
  writeStdout(`Database: ${config.dbPath}`)

  // Pre-warm one Codex runtime so the first user send does not pay the subprocess
  // spawn+handshake cost inline. Failures log but do not abort startup; the next
  // submission will spawn a fresh runtime on demand.
  void threadRuntimeManager.warmBootstrap().catch((error) => {
    writeStderr(`Bootstrap runtime warmup failed: ${String(error)}`)
  })

  // Initial sync at startup so the UI sees fresh data immediately rather than waiting an hour.
  void canvasSync.sync().catch((error) => {
    writeStderr(`Initial canvas sync failed: ${String(error)}`)
  })

  const hourlyTimer = setInterval(() => {
    void canvasSync.sync().catch((error) => {
      writeStderr(`Hourly canvas sync failed: ${String(error)}`)
    })
  }, ONE_HOUR_MS)

  const shutdown = () => {
    writeStdout("")
    writeStdout("Shutting down...")
    clearInterval(hourlyTimer)
    orchestration.shutdown()
      .catch(() => undefined)
      .finally(() => {
        codex.shutdown()
          .catch(() => undefined)
          .finally(() => {
            db.close()
            ws.close().then(() => {
              writeStdout("Server stopped.")
              process.exit(0)
            })
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
