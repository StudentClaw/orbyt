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
 * Branded identifier for chat workspaces.
 */
export const WorkspaceId = Schema.String.pipe(Schema.brand("WorkspaceId"))

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
 * Runtime type for workspace identifiers.
 */
export type WorkspaceId = Schema.Schema.Type<typeof WorkspaceId>

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
  ORCHESTRATION_CREATE_WORKSPACE: "orchestration.createWorkspace",
  ORCHESTRATION_RELINK_WORKSPACE: "orchestration.relinkWorkspace",
  ORCHESTRATION_DELETE_WORKSPACE: "orchestration.deleteWorkspace",
  ORCHESTRATION_CREATE_THREAD: "orchestration.createThread",
  ORCHESTRATION_SEND_TURN: "orchestration.sendTurn",
  ORCHESTRATION_INTERRUPT_TURN: "orchestration.interruptTurn",
  ORCHESTRATION_SUBSCRIBE_DOMAIN: "orchestration.subscribeDomain",
  PROVIDER_START_AUTH: "provider.startAuth",
  PROVIDER_RETRY_INITIALIZE: "provider.retryInitialize",
  PROVIDER_SUBSCRIBE_RUNTIME: "provider.subscribeRuntime",
  CANVAS_GET_COURSES: "canvas.getCourses",
  CANVAS_SYNC: "canvas.sync",
  DASHBOARD_REFRESH: "dashboard.refresh",
  PLANNER_GET_SESSIONS: "planner.getSessions",
  PLANNER_CHECK_IN: "planner.checkIn",
  ACTIVITY_SUBSCRIBE_FEED: "activity.subscribeFeed",
  ONBOARDING_GET_SNAPSHOT: "onboarding.getSnapshot",
  ONBOARDING_SET_STEP_STATUS: "onboarding.setStepStatus",
  ONBOARDING_SET_OVERALL_STATUS: "onboarding.setOverallStatus",
  ONBOARDING_GET_PREFERENCES: "onboarding.getPreferences",
  ONBOARDING_SET_PREFERENCES: "onboarding.setPreferences",
  ONBOARDING_SET_ROUTINES: "onboarding.setRoutines",
  ONBOARDING_GET_AI_AUTH: "onboarding.getAiAuth",
  ONBOARDING_SET_AI_AUTH: "onboarding.setAiAuth",
  DEV_RESET_SOFT: "dev.resetSoft",
  DEV_RESET_HARD: "dev.resetHard",
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
 * Snapshot of a persisted chat workspace.
 */
export const OrchestrationWorkspace = Schema.Union(
  Schema.Struct({
    id: WorkspaceId,
    kind: Schema.Literal("filesystem"),
    name: Schema.String,
    rootPath: Schema.String,
    availability: Schema.Literal("ready", "missing"),
    createdAt: Schema.String,
    updatedAt: Schema.String,
  }),
  Schema.Struct({
    id: WorkspaceId,
    kind: Schema.Literal("legacy"),
    name: Schema.String,
    rootPath: Schema.Null,
    availability: Schema.Null,
    createdAt: Schema.String,
    updatedAt: Schema.String,
  }),
)

/**
 * Snapshot of a persisted orchestration thread.
 */
export const OrchestrationThread = Schema.Struct({
  id: ThreadId,
  workspaceId: WorkspaceId,
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

/**
 * Full orchestration state returned to the renderer.
 */
export const OrchestrationSnapshot = Schema.Struct({
  workspaces: Schema.Array(OrchestrationWorkspace),
  threads: Schema.Array(OrchestrationThread),
  turns: Schema.Array(OrchestrationTurn),
  providerStatus: ProviderRuntimeStatus,
  providerRuntime: ProviderRuntimeState,
  ready: Schema.Boolean,
  lastSequence: Schema.Number,
})

/**
 * Parameters for creating a new chat workspace.
 */
export const CreateWorkspaceParams = Schema.Struct({
  rootPath: Schema.String,
})

/**
 * Result returned after a workspace is created or resolved.
 */
export const CreateWorkspaceResult = Schema.Struct({
  workspaceId: WorkspaceId,
})

/**
 * Parameters for relinking an existing chat workspace.
 */
export const RelinkWorkspaceParams = Schema.Struct({
  workspaceId: WorkspaceId,
  rootPath: Schema.String,
})

/**
 * Result returned after a workspace is relinked.
 */
export const RelinkWorkspaceResult = Schema.Struct({
  workspaceId: WorkspaceId,
})

/**
 * Parameters for deleting a chat workspace.
 */
export const DeleteWorkspaceParams = Schema.Struct({
  workspaceId: WorkspaceId,
})

/**
 * Result returned after a workspace is deleted.
 */
export const DeleteWorkspaceResult = Schema.Struct({
  deleted: Schema.Boolean,
})

/**
 * Parameters for creating a new orchestration thread.
 */
export const CreateThreadParams = Schema.Struct({
  title: Schema.optional(Schema.String.pipe(Schema.maxLength(MAX_THREAD_TITLE_LENGTH))),
  workspaceId: WorkspaceId,
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

export const StartProviderAuthParams = Schema.Struct({})

export const StartProviderAuthResult = Schema.Struct({
  started: Schema.Boolean,
})

export const RetryProviderInitializeParams = Schema.Struct({})

export const RetryProviderInitializeResult = Schema.Struct({
  started: Schema.Boolean,
})

/**
 * Provider runtime events streamed to the renderer.
 */
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

/**
 * Domain events streamed to the renderer as orchestration state changes.
 */
export const OrchestrationDomainEvent = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("workspace.created"),
    workspace: OrchestrationWorkspace,
  }),
  Schema.Struct({
    type: Schema.Literal("workspace.updated"),
    workspace: OrchestrationWorkspace,
  }),
  Schema.Struct({
    type: Schema.Literal("workspace.deleted"),
    workspaceId: WorkspaceId,
    deletedThreadIds: Schema.Array(ThreadId),
  }),
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
 * Runtime type for workspace snapshots.
 */
export type OrchestrationWorkspace = Schema.Schema.Type<typeof OrchestrationWorkspace>

/**
 * Runtime type for thread snapshots.
 */
export type OrchestrationThread = Schema.Schema.Type<typeof OrchestrationThread>

/**
 * Runtime type for turn snapshots.
 */
export type OrchestrationTurn = Schema.Schema.Type<typeof OrchestrationTurn>
export type ProviderRuntimeStatus = Schema.Schema.Type<typeof ProviderRuntimeStatus>
export type ProviderAuthState = Schema.Schema.Type<typeof ProviderAuthState>
export type ProviderRuntimeError = Schema.Schema.Type<typeof ProviderRuntimeError>
export type ProviderRuntimeState = Schema.Schema.Type<typeof ProviderRuntimeState>

/**
 * Runtime type for orchestration snapshots.
 */
export type OrchestrationSnapshot = Schema.Schema.Type<typeof OrchestrationSnapshot>

/**
 * Runtime type for create-workspace parameters.
 */
export type CreateWorkspaceParams = Schema.Schema.Type<typeof CreateWorkspaceParams>

/**
 * Runtime type for create-workspace results.
 */
export type CreateWorkspaceResult = Schema.Schema.Type<typeof CreateWorkspaceResult>

/**
 * Runtime type for relink-workspace parameters.
 */
export type RelinkWorkspaceParams = Schema.Schema.Type<typeof RelinkWorkspaceParams>

/**
 * Runtime type for relink-workspace results.
 */
export type RelinkWorkspaceResult = Schema.Schema.Type<typeof RelinkWorkspaceResult>

/**
 * Runtime type for delete-workspace parameters.
 */
export type DeleteWorkspaceParams = Schema.Schema.Type<typeof DeleteWorkspaceParams>

/**
 * Runtime type for delete-workspace results.
 */
export type DeleteWorkspaceResult = Schema.Schema.Type<typeof DeleteWorkspaceResult>

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
export type StartProviderAuthParams = Schema.Schema.Type<typeof StartProviderAuthParams>
export type StartProviderAuthResult = Schema.Schema.Type<typeof StartProviderAuthResult>
export type RetryProviderInitializeParams = Schema.Schema.Type<typeof RetryProviderInitializeParams>
export type RetryProviderInitializeResult = Schema.Schema.Type<typeof RetryProviderInitializeResult>

/**
 * Runtime type for provider events.
 */
export type ProviderRuntimeEvent = Schema.Schema.Type<typeof ProviderRuntimeEvent>

/**
 * Runtime type for orchestration domain events.
 */
export type OrchestrationDomainEvent = Schema.Schema.Type<typeof OrchestrationDomainEvent>
