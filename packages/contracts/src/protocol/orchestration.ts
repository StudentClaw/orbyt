import { Schema } from "@effect/schema"
import { DesktopBootstrap } from "./desktop.js"

/**
 * Maximum number of characters allowed in a user-provided thread title.
 */
export const MAX_THREAD_TITLE_LENGTH = 200

/**
 * Maximum number of characters allowed in a single turn submission.
 */
export const MAX_TURN_CONTENT_LENGTH = 16_384

/**
 * Subprotocol used by authenticated Student Claw WebSocket clients.
 */
export const WS_PROTOCOL = "student-claw.v1"

/**
 * Branded identifier for orchestration threads.
 */
export const ThreadId = Schema.String.pipe(Schema.brand("ThreadId"))

/**
 * Branded identifier for orchestration turns.
 */
export const TurnId = Schema.String.pipe(Schema.brand("TurnId"))

/**
 * Branded identifier for runtime command receipts.
 */
export const CommandId = Schema.String.pipe(Schema.brand("CommandId"))

/**
 * Runtime type for thread identifiers.
 */
export type ThreadId = Schema.Schema.Type<typeof ThreadId>

/**
 * Runtime type for turn identifiers.
 */
export type TurnId = Schema.Schema.Type<typeof TurnId>

/**
 * Runtime type for command identifiers.
 */
export type CommandId = Schema.Schema.Type<typeof CommandId>

/**
 * RPC methods supported by the local Student Claw runtime.
 */
export const RPC_METHODS = {
  SERVER_GET_BOOTSTRAP: "server.getBootstrap",
  SERVER_GET_CONFIG: "server.getConfig",
  SERVER_SUBSCRIBE_LIFECYCLE: "server.subscribeLifecycle",
  SERVER_SUBSCRIBE_CONFIG: "server.subscribeConfig",
  ORCHESTRATION_GET_SNAPSHOT: "orchestration.getSnapshot",
  ORCHESTRATION_CREATE_THREAD: "orchestration.createThread",
  ORCHESTRATION_SEND_TURN: "orchestration.sendTurn",
  ORCHESTRATION_INTERRUPT_TURN: "orchestration.interruptTurn",
  ORCHESTRATION_SUBSCRIBE_DOMAIN: "orchestration.subscribeDomain",
  PROVIDER_SUBSCRIBE_RUNTIME: "provider.subscribeRuntime",
  CANVAS_GET_COURSES: "canvas.getCourses",
  CANVAS_SYNC: "canvas.sync",
  DASHBOARD_REFRESH: "dashboard.refresh",
  PLANNER_GET_SESSIONS: "planner.getSessions",
  PLANNER_CHECK_IN: "planner.checkIn",
  ACTIVITY_SUBSCRIBE_FEED: "activity.subscribeFeed",
} as const

/**
 * Push channels exposed by the local Student Claw runtime.
 */
export const PUSH_CHANNELS = {
  SERVER_LIFECYCLE: "server.lifecycle",
  SERVER_CONFIG: "server.config",
  ORCHESTRATION_DOMAIN: "orchestration.domain",
  PROVIDER_RUNTIME: "provider.runtime",
  CANVAS_SYNC_PROGRESS: "canvas.syncProgress",
  DASHBOARD_UPDATE: "dashboard.update",
  PLANNER_SESSION_CHECK_IN: "planner.sessionCheckIn",
  ACTIVITY_FEED: "activity.feed",
} as const

/**
 * Capability flags advertised by the local runtime.
 */
export const ServerCapabilities = Schema.Struct({
  orchestration: Schema.Boolean,
  providerRuntime: Schema.Boolean,
  desktopBootstrap: Schema.Boolean,
})

/**
 * Static server configuration snapshot.
 */
export const ServerConfig = Schema.Struct({
  appVersion: Schema.String,
  platform: Schema.String,
  protocolVersion: Schema.String,
  capabilities: ServerCapabilities,
})

/**
 * Welcome payload delivered over the lifecycle stream.
 */
export const ServerLifecycleWelcomePayload = Schema.Struct({
  bootstrap: DesktopBootstrap,
  connectedAt: Schema.String,
})

/**
 * Lifecycle events emitted by the runtime.
 */
export const ServerLifecycleEvent = Schema.Struct({
  type: Schema.Literal("welcome"),
  payload: ServerLifecycleWelcomePayload,
})

/**
 * Server configuration stream events.
 */
export const ServerConfigStreamEvent = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("snapshot"),
    config: ServerConfig,
  }),
)

/**
 * Snapshot of a persisted orchestration thread.
 */
export const OrchestrationThread = Schema.Struct({
  id: ThreadId,
  title: Schema.String,
  status: Schema.Literal("idle", "streaming", "interrupted", "completed"),
  createdAt: Schema.String,
  currentTurnId: Schema.NullOr(TurnId),
})

/**
 * Snapshot of a persisted orchestration turn.
 */
export const OrchestrationTurn = Schema.Struct({
  id: TurnId,
  threadId: ThreadId,
  input: Schema.String,
  output: Schema.String,
  status: Schema.Literal("pending", "streaming", "interrupted", "completed"),
  startedAt: Schema.String,
  completedAt: Schema.NullOr(Schema.String),
})

/**
 * Full orchestration state returned to the renderer.
 */
export const OrchestrationSnapshot = Schema.Struct({
  threads: Schema.Array(OrchestrationThread),
  turns: Schema.Array(OrchestrationTurn),
  providerStatus: Schema.Literal("idle", "streaming", "interrupted", "offline"),
  ready: Schema.Boolean,
  lastSequence: Schema.Number,
})

/**
 * Parameters for creating a new orchestration thread.
 */
export const CreateThreadParams = Schema.Struct({
  title: Schema.optional(Schema.String.pipe(Schema.maxLength(MAX_THREAD_TITLE_LENGTH))),
})

/**
 * Result returned after a thread is created.
 */
export const CreateThreadResult = Schema.Struct({
  threadId: ThreadId,
})

/**
 * Parameters for submitting a turn to the orchestrator.
 */
export const SendTurnParams = Schema.Struct({
  threadId: ThreadId,
  content: Schema.String.pipe(Schema.maxLength(MAX_TURN_CONTENT_LENGTH)),
})

/**
 * Result returned after a turn is accepted for processing.
 */
export const SendTurnResult = Schema.Struct({
  turnId: TurnId,
})

/**
 * Parameters for interrupting an active turn.
 */
export const InterruptTurnParams = Schema.Struct({
  threadId: ThreadId,
})

/**
 * Result returned after interrupting an active turn.
 */
export const InterruptTurnResult = Schema.Struct({
  interrupted: Schema.Boolean,
})

/**
 * Provider runtime events streamed to the renderer.
 */
export const ProviderRuntimeEvent = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("provider.turnStarted"),
    threadId: ThreadId,
    turnId: TurnId,
  }),
  Schema.Struct({
    type: Schema.Literal("provider.token"),
    threadId: ThreadId,
    turnId: TurnId,
    token: Schema.String,
    index: Schema.Number,
  }),
  Schema.Struct({
    type: Schema.Literal("provider.turnCompleted"),
    threadId: ThreadId,
    turnId: TurnId,
    output: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("provider.turnInterrupted"),
    threadId: ThreadId,
    turnId: TurnId,
  }),
)

/**
 * Domain events streamed to the renderer as orchestration state changes.
 */
export const OrchestrationDomainEvent = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("thread.created"),
    thread: OrchestrationThread,
  }),
  Schema.Struct({
    type: Schema.Literal("turn.started"),
    turn: OrchestrationTurn,
  }),
  Schema.Struct({
    type: Schema.Literal("turn.updated"),
    turn: OrchestrationTurn,
  }),
  Schema.Struct({
    type: Schema.Literal("turn.completed"),
    turn: OrchestrationTurn,
  }),
  Schema.Struct({
    type: Schema.Literal("turn.interrupted"),
    turn: OrchestrationTurn,
  }),
)

/**
 * Runtime type for lifecycle events.
 */
export type ServerLifecycleEvent = Schema.Schema.Type<typeof ServerLifecycleEvent>

/**
 * Runtime type for server capability flags.
 */
export type ServerCapabilities = Schema.Schema.Type<typeof ServerCapabilities>

/**
 * Runtime type for server configuration.
 */
export type ServerConfig = Schema.Schema.Type<typeof ServerConfig>

/**
 * Runtime type for lifecycle welcome payloads.
 */
export type ServerLifecycleWelcomePayload = Schema.Schema.Type<typeof ServerLifecycleWelcomePayload>

/**
 * Runtime type for configuration stream events.
 */
export type ServerConfigStreamEvent = Schema.Schema.Type<typeof ServerConfigStreamEvent>

/**
 * Runtime type for thread snapshots.
 */
export type OrchestrationThread = Schema.Schema.Type<typeof OrchestrationThread>

/**
 * Runtime type for turn snapshots.
 */
export type OrchestrationTurn = Schema.Schema.Type<typeof OrchestrationTurn>

/**
 * Runtime type for orchestration snapshots.
 */
export type OrchestrationSnapshot = Schema.Schema.Type<typeof OrchestrationSnapshot>

/**
 * Runtime type for create-thread parameters.
 */
export type CreateThreadParams = Schema.Schema.Type<typeof CreateThreadParams>

/**
 * Runtime type for create-thread results.
 */
export type CreateThreadResult = Schema.Schema.Type<typeof CreateThreadResult>

/**
 * Runtime type for send-turn parameters.
 */
export type SendTurnParams = Schema.Schema.Type<typeof SendTurnParams>

/**
 * Runtime type for send-turn results.
 */
export type SendTurnResult = Schema.Schema.Type<typeof SendTurnResult>

/**
 * Runtime type for interrupt-turn parameters.
 */
export type InterruptTurnParams = Schema.Schema.Type<typeof InterruptTurnParams>

/**
 * Runtime type for interrupt-turn results.
 */
export type InterruptTurnResult = Schema.Schema.Type<typeof InterruptTurnResult>

/**
 * Runtime type for provider events.
 */
export type ProviderRuntimeEvent = Schema.Schema.Type<typeof ProviderRuntimeEvent>

/**
 * Runtime type for orchestration domain events.
 */
export type OrchestrationDomainEvent = Schema.Schema.Type<typeof OrchestrationDomainEvent>
