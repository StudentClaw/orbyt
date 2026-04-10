import { Schema } from "@effect/schema"
import { DesktopBootstrap } from "./desktop.js"

export const ThreadId = Schema.String.pipe(Schema.brand("ThreadId"))
export const TurnId = Schema.String.pipe(Schema.brand("TurnId"))
export const CommandId = Schema.String.pipe(Schema.brand("CommandId"))

export type ThreadId = Schema.Schema.Type<typeof ThreadId>
export type TurnId = Schema.Schema.Type<typeof TurnId>
export type CommandId = Schema.Schema.Type<typeof CommandId>

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
  PROVIDER_START_AUTH: "provider.startAuth",
  PROVIDER_RETRY_INITIALIZE: "provider.retryInitialize",
  PROVIDER_SUBSCRIBE_RUNTIME: "provider.subscribeRuntime",
} as const

export const PUSH_CHANNELS = {
  SERVER_LIFECYCLE: "server.lifecycle",
  SERVER_CONFIG: "server.config",
  ORCHESTRATION_DOMAIN: "orchestration.domain",
  PROVIDER_RUNTIME: "provider.runtime",
} as const

export const ServerCapabilities = Schema.Struct({
  orchestration: Schema.Boolean,
  providerRuntime: Schema.Boolean,
  desktopBootstrap: Schema.Boolean,
})

export const ServerConfig = Schema.Struct({
  appVersion: Schema.String,
  platform: Schema.String,
  protocolVersion: Schema.String,
  capabilities: ServerCapabilities,
})

export const ServerLifecycleWelcomePayload = Schema.Struct({
  bootstrap: DesktopBootstrap,
  connectedAt: Schema.String,
})

export const ServerLifecycleEvent = Schema.Struct({
  type: Schema.Literal("welcome"),
  payload: ServerLifecycleWelcomePayload,
})

export const ServerConfigStreamEvent = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("snapshot"),
    config: ServerConfig,
  }),
)

export const OrchestrationThread = Schema.Struct({
  id: ThreadId,
  title: Schema.String,
  status: Schema.Literal("idle", "streaming", "interrupted", "completed"),
  createdAt: Schema.String,
  currentTurnId: Schema.NullOr(TurnId),
})

export const OrchestrationTurn = Schema.Struct({
  id: TurnId,
  threadId: ThreadId,
  input: Schema.String,
  output: Schema.String,
  status: Schema.Literal("pending", "streaming", "interrupted", "completed"),
  startedAt: Schema.String,
  completedAt: Schema.NullOr(Schema.String),
})

export const ProviderRuntimeStatus = Schema.Literal(
  "idle",
  "streaming",
  "interrupted",
  "offline",
  "initializing",
  "auth_required",
  "degraded",
  "rate_limited",
)

export const ProviderAuthState = Schema.Literal(
  "unknown",
  "authenticated",
  "auth_required",
  "expired",
)

export const ProviderRuntimeError = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
})

export const ProviderRuntimeState = Schema.Struct({
  adapter: Schema.Literal("stub", "codex"),
  status: ProviderRuntimeStatus,
  authState: ProviderAuthState,
  lastError: Schema.NullOr(ProviderRuntimeError),
  queuedTurnCount: Schema.Number,
  lastUpdatedAt: Schema.String,
})

export const OrchestrationSnapshot = Schema.Struct({
  threads: Schema.Array(OrchestrationThread),
  turns: Schema.Array(OrchestrationTurn),
  providerStatus: ProviderRuntimeStatus,
  providerRuntime: ProviderRuntimeState,
  ready: Schema.Boolean,
  lastSequence: Schema.Number,
})

export const CreateThreadParams = Schema.Struct({
  title: Schema.optional(Schema.String),
})

export const CreateThreadResult = Schema.Struct({
  threadId: ThreadId,
})

export const SendTurnParams = Schema.Struct({
  threadId: ThreadId,
  content: Schema.String,
})

export const SendTurnResult = Schema.Struct({
  turnId: TurnId,
})

export const InterruptTurnParams = Schema.Struct({
  threadId: ThreadId,
})

export const InterruptTurnResult = Schema.Struct({
  interrupted: Schema.Boolean,
})

export const StartProviderAuthParams = Schema.Struct({})

export const StartProviderAuthResult = Schema.Struct({
  started: Schema.Boolean,
})

export const RetryProviderInitializeParams = Schema.Struct({})

export const RetryProviderInitializeResult = Schema.Struct({
  started: Schema.Boolean,
})

export const ProviderRuntimeEvent = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("provider.stateChanged"),
    state: ProviderRuntimeState,
  }),
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

export type ServerLifecycleEvent = Schema.Schema.Type<typeof ServerLifecycleEvent>
export type ServerCapabilities = Schema.Schema.Type<typeof ServerCapabilities>
export type ServerConfig = Schema.Schema.Type<typeof ServerConfig>
export type ServerLifecycleWelcomePayload = Schema.Schema.Type<typeof ServerLifecycleWelcomePayload>
export type ServerConfigStreamEvent = Schema.Schema.Type<typeof ServerConfigStreamEvent>
export type OrchestrationThread = Schema.Schema.Type<typeof OrchestrationThread>
export type OrchestrationTurn = Schema.Schema.Type<typeof OrchestrationTurn>
export type ProviderRuntimeStatus = Schema.Schema.Type<typeof ProviderRuntimeStatus>
export type ProviderAuthState = Schema.Schema.Type<typeof ProviderAuthState>
export type ProviderRuntimeError = Schema.Schema.Type<typeof ProviderRuntimeError>
export type ProviderRuntimeState = Schema.Schema.Type<typeof ProviderRuntimeState>
export type OrchestrationSnapshot = Schema.Schema.Type<typeof OrchestrationSnapshot>
export type CreateThreadParams = Schema.Schema.Type<typeof CreateThreadParams>
export type CreateThreadResult = Schema.Schema.Type<typeof CreateThreadResult>
export type SendTurnParams = Schema.Schema.Type<typeof SendTurnParams>
export type SendTurnResult = Schema.Schema.Type<typeof SendTurnResult>
export type InterruptTurnParams = Schema.Schema.Type<typeof InterruptTurnParams>
export type InterruptTurnResult = Schema.Schema.Type<typeof InterruptTurnResult>
export type StartProviderAuthParams = Schema.Schema.Type<typeof StartProviderAuthParams>
export type StartProviderAuthResult = Schema.Schema.Type<typeof StartProviderAuthResult>
export type RetryProviderInitializeParams = Schema.Schema.Type<typeof RetryProviderInitializeParams>
export type RetryProviderInitializeResult = Schema.Schema.Type<typeof RetryProviderInitializeResult>
export type ProviderRuntimeEvent = Schema.Schema.Type<typeof ProviderRuntimeEvent>
export type OrchestrationDomainEvent = Schema.Schema.Type<typeof OrchestrationDomainEvent>
