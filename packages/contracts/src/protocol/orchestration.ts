import { Schema } from "@effect/schema"
import { SkillId } from "../schemas/ids.js"
import { ActivityFeedEntry } from "../schemas/activity-feed-entry.js"
import { WeeklyInsight } from "../schemas/weekly-insight.js"
import { DesktopBootstrap } from "./desktop.js"
import { FeatureFlags } from "./feature-flags.js"

/**
 * Maximum number of characters allowed in a user-provided thread title.
 */
export const MAX_THREAD_TITLE_LENGTH = 200

/**
 * Maximum number of characters allowed in a single turn submission.
 */
export const MAX_TURN_CONTENT_LENGTH = 16_384

/**
 * Subprotocol used by authenticated Orbyt WebSocket clients.
 */
export const WS_PROTOCOL = "orbyt.v1"

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
 * RPC methods supported by the local Orbyt runtime.
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
  ORCHESTRATION_RENAME_THREAD: "orchestration.renameThread",
  ORCHESTRATION_SET_THREAD_ACCESS_MODE: "orchestration.setThreadAccessMode",
  ORCHESTRATION_DELETE_THREAD: "orchestration.deleteThread",
  ORCHESTRATION_SEND_TURN: "orchestration.sendTurn",
  ORCHESTRATION_INTERRUPT_TURN: "orchestration.interruptTurn",
  ORCHESTRATION_SUBSCRIBE_DOMAIN: "orchestration.subscribeDomain",
  PROVIDER_START_AUTH: "provider.startAuth",
  PROVIDER_RETRY_INITIALIZE: "provider.retryInitialize",
  PROVIDER_RESPOND_TO_APPROVAL: "provider.respondToApproval",
  PROVIDER_SUBSCRIBE_RUNTIME: "provider.subscribeRuntime",
  CANVAS_LIST_COURSES: "canvas.listCourses",
  CANVAS_GET_MY_UPCOMING_ASSIGNMENTS: "canvas.getMyUpcomingAssignments",
  CANVAS_GET_MY_SUBMISSION_STATUS: "canvas.getMySubmissionStatus",
  CANVAS_GET_MY_COURSE_GRADES: "canvas.getMyCourseGrades",
  CANVAS_GET_MY_TODO_ITEMS: "canvas.getMyTodoItems",
  CANVAS_GET_MY_PEER_REVIEWS_TODO: "canvas.getMyPeerReviewsTodo",
  CANVAS_GET_ASSIGNMENT_DETAILS: "canvas.getAssignmentDetails",
  CANVAS_LIST_ASSIGNMENTS: "canvas.listAssignments",
  CANVAS_GET_COURSE_CONTENT_OVERVIEW: "canvas.getCourseContentOverview",
  CANVAS_GET_COURSE_STRUCTURE: "canvas.getCourseStructure",
  CANVAS_DOWNLOAD_COURSE_FILE: "canvas.downloadCourseFile",
  CANVAS_SYNC: "canvas.sync",
  CANVAS_SUBSCRIBE_SYNC_PROGRESS: "canvas.subscribeSyncProgress",
  DASHBOARD_REFRESH: "dashboard.refresh",
  DASHBOARD_SUBSCRIBE_UPDATES: "dashboard.subscribeUpdates",
  PLANNER_GET_SESSIONS: "planner.getSessions",
  PLANNER_CHECK_IN: "planner.checkIn",
  PLANNER_SUBSCRIBE_CHECK_INS: "planner.subscribeCheckIns",
  ACTIVITY_SUBSCRIBE_FEED: "activity.subscribeFeed",
  ACTIVITY_GENERATE_WEEKLY_INSIGHT: "activity.generateWeeklyInsight",
  ACTIVITY_SET_ACTED: "activity.setActed",
  ONBOARDING_GET_SNAPSHOT: "onboarding.getSnapshot",
  ONBOARDING_SET_STEP_STATUS: "onboarding.setStepStatus",
  ONBOARDING_SET_OVERALL_STATUS: "onboarding.setOverallStatus",
  ONBOARDING_GET_PREFERENCES: "onboarding.getPreferences",
  ONBOARDING_SET_PREFERENCES: "onboarding.setPreferences",
  ONBOARDING_GET_ROUTINES: "onboarding.getRoutines",
  ONBOARDING_SET_ROUTINES: "onboarding.setRoutines",
  ONBOARDING_GET_AI_AUTH: "onboarding.getAiAuth",
  ONBOARDING_SET_AI_AUTH: "onboarding.setAiAuth",
  ONBOARDING_GET_DNA: "onboarding.getDna",
  ONBOARDING_SET_ANSWERS: "onboarding.setAnswers",
  ONBOARDING_CLASSIFY_DNA: "onboarding.classifyDna",
  ONBOARDING_GET_CARD_WEIGHTS: "onboarding.getCardWeights",
  SKILLS_LIST: "skills.list",
  SKILLS_FORK: "skills.fork",
  SKILLS_GRANT_CAPABILITY: "skills.grantCapability",
  SKILLS_REVOKE_CAPABILITY: "skills.revokeCapability",
  SKILLS_SAVE_CUSTOM: "skills.saveCustom",
  DEV_RESET_SOFT: "dev.resetSoft",
  DEV_RESET_HARD: "dev.resetHard",
  MEMORIZE_RUN: "memorize.run",
  MEMORY_SUBSCRIBE_UPDATES: "memory.subscribeUpdates",
} as const

/**
 * Push channels exposed by the local Orbyt runtime.
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
  MEMORY_UPDATED: "memory.updated",
} as const

/**
 * Capability flags advertised by the local runtime.
 */
export const ServerCapabilities = Schema.Struct({
  orchestration: Schema.Boolean,
  providerRuntime: Schema.Boolean,
  desktopBootstrap: Schema.Boolean,
})

export const ChatModelGroup = Schema.Literal("standard", "reasoning")

export const ChatModelId = Schema.Literal("gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex")

export const ChatModel = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  description: Schema.String,
  group: ChatModelGroup,
})

/**
 * Static server configuration snapshot.
 */
export const ServerConfig = Schema.Struct({
  appVersion: Schema.String,
  platform: Schema.String,
  protocolVersion: Schema.String,
  capabilities: ServerCapabilities,
  defaultChatModel: Schema.String,
  chatModels: Schema.Array(ChatModel),
  featureFlags: FeatureFlags,
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

export { ActivityFeedEntry, WeeklyInsight }

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
  accessMode: Schema.Literal("default", "full"),
  status: Schema.Literal("idle", "queued", "streaming", "interrupting", "interrupted", "completed"),
  createdAt: Schema.String,
  currentTurnId: Schema.NullOr(TurnId),
})

export const TurnAttachmentKind = Schema.Literal("image", "file")

export const TurnAttachmentInput = Schema.Struct({
  path: Schema.String.pipe(Schema.maxLength(4096)),
  name: Schema.String.pipe(Schema.maxLength(255)),
  mimeType: Schema.NullOr(Schema.String),
  sizeBytes: Schema.NullOr(Schema.Number),
  kind: TurnAttachmentKind,
})

export const OrchestrationTurnAttachment = Schema.Struct({
  id: Schema.String,
  path: Schema.String,
  name: Schema.String,
  mimeType: Schema.NullOr(Schema.String),
  sizeBytes: Schema.NullOr(Schema.Number),
  kind: TurnAttachmentKind,
})

/**
 * Snapshot of a persisted orchestration turn.
 */
export const OrchestrationTurn = Schema.Struct({
  id: TurnId,
  threadId: ThreadId,
  input: Schema.String,
  output: Schema.String,
  reasoning: Schema.String,
  status: Schema.Literal("queued", "streaming", "interrupting", "interrupted", "completed"),
  startedAt: Schema.String,
  completedAt: Schema.NullOr(Schema.String),
  skill: Schema.NullOr(Schema.Struct({ id: SkillId, name: Schema.String })),
  attachments: Schema.Array(OrchestrationTurnAttachment),
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

export const ThreadAccessMode = Schema.Literal("default", "full")

export const ProviderApprovalDecision = Schema.Literal("approve", "deny")

export const ProviderPendingApproval = Schema.Struct({
  id: Schema.String,
  threadId: ThreadId,
  turnId: TurnId,
  kind: Schema.Literal("command", "file-change", "permissions"),
  itemId: Schema.String,
  approvalId: Schema.NullOr(Schema.String),
  reason: Schema.NullOr(Schema.String),
  command: Schema.NullOr(Schema.String),
  cwd: Schema.NullOr(Schema.String),
  availableDecisions: Schema.Array(ProviderApprovalDecision),
})

/**
 * Full orchestration state returned to the renderer.
 */
export const OrchestrationSnapshot = Schema.Struct({
  workspaces: Schema.Array(OrchestrationWorkspace),
  threads: Schema.Array(OrchestrationThread),
  turns: Schema.Array(OrchestrationTurn),
  pendingApprovals: Schema.Array(ProviderPendingApproval),
  providerStatus: ProviderRuntimeStatus,
  providerRuntime: ProviderRuntimeState,
  chatSendReady: Schema.Boolean,
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
 * Parameters for renaming an orchestration thread.
 */
export const RenameThreadParams = Schema.Struct({
  threadId: ThreadId,
  title: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(MAX_THREAD_TITLE_LENGTH)),
})

/**
 * Result returned after a thread is renamed.
 */
export const RenameThreadResult = Schema.Struct({
  threadId: ThreadId,
})

export const SetThreadAccessModeParams = Schema.Struct({
  threadId: ThreadId,
  accessMode: ThreadAccessMode,
})

export const SetThreadAccessModeResult = Schema.Struct({
  threadId: ThreadId,
  accessMode: ThreadAccessMode,
})

/**
 * Parameters for deleting an orchestration thread.
 */
export const DeleteThreadParams = Schema.Struct({
  threadId: ThreadId,
})

/**
 * Result returned after a thread is deleted.
 */
export const DeleteThreadResult = Schema.Struct({
  deleted: Schema.Boolean,
})

/**
 * Parameters for submitting a turn to the orchestrator.
 */
export const SendTurnParams = Schema.Struct({
  threadId: ThreadId,
  content: Schema.String.pipe(Schema.maxLength(MAX_TURN_CONTENT_LENGTH)),
  attachments: Schema.Array(TurnAttachmentInput),
  skillId: Schema.optional(SkillId),
  model: Schema.optional(ChatModelId),
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

export const SkillEntry = Schema.Struct({
  id: SkillId,
  name: Schema.String,
  description: Schema.String,
})
export type SkillEntry = Schema.Schema.Type<typeof SkillEntry>

export const ListSkillsResult = Schema.Struct({
  skills: Schema.Array(SkillEntry),
})
export type ListSkillsResult = Schema.Schema.Type<typeof ListSkillsResult>

export const StartProviderAuthParams = Schema.Struct({})

export const StartProviderAuthResult = Schema.Struct({
  started: Schema.Boolean,
})

export const RetryProviderInitializeParams = Schema.Struct({})

export const RetryProviderInitializeResult = Schema.Struct({
  started: Schema.Boolean,
})

export const RespondToProviderApprovalParams = Schema.Struct({
  approvalRequestId: Schema.String,
  decision: ProviderApprovalDecision,
})

export const RespondToProviderApprovalResult = Schema.Struct({
  approvalRequestId: Schema.String,
  resolved: Schema.Boolean,
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
    type: Schema.Literal("provider.readinessChanged"),
    chatSendReady: Schema.Boolean,
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
    type: Schema.Literal("provider.reasoning"),
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
    type: Schema.Literal("provider.interruptionRequested"),
    threadId: ThreadId,
    turnId: TurnId,
  }),
  Schema.Struct({
    type: Schema.Literal("provider.turnInterrupted"),
    threadId: ThreadId,
    turnId: TurnId,
  }),
  Schema.Struct({
    type: Schema.Literal("provider.mcpToolCall"),
    threadId: ThreadId,
    turnId: TurnId,
    itemId: Schema.String,
    serverName: Schema.String,
    toolName: Schema.String,
    args: Schema.Unknown,
    status: Schema.Literal("pending", "complete", "error"),
    message: Schema.optional(Schema.String),
    error: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    type: Schema.Literal("provider.approvalRequested"),
    approval: ProviderPendingApproval,
  }),
  Schema.Struct({
    type: Schema.Literal("provider.approvalResolved"),
    approvalRequestId: Schema.String,
    threadId: ThreadId,
    turnId: TurnId,
    decision: ProviderApprovalDecision,
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
    type: Schema.Literal("thread.updated"),
    thread: OrchestrationThread,
  }),
  Schema.Struct({
    type: Schema.Literal("thread.deleted"),
    threadId: ThreadId,
    workspaceId: WorkspaceId,
  }),
  Schema.Struct({
    type: Schema.Literal("turn.queued"),
    turn: OrchestrationTurn,
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

export type ChatModelGroup = Schema.Schema.Type<typeof ChatModelGroup>
export type ChatModelId = Schema.Schema.Type<typeof ChatModelId>
export type ChatModel = Schema.Schema.Type<typeof ChatModel>

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
export type TurnAttachmentKind = Schema.Schema.Type<typeof TurnAttachmentKind>
export type TurnAttachmentInput = Schema.Schema.Type<typeof TurnAttachmentInput>
export type OrchestrationTurnAttachment = Schema.Schema.Type<typeof OrchestrationTurnAttachment>

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
 * Runtime type for rename-thread parameters.
 */
export type RenameThreadParams = Schema.Schema.Type<typeof RenameThreadParams>

/**
 * Runtime type for rename-thread results.
 */
export type RenameThreadResult = Schema.Schema.Type<typeof RenameThreadResult>

/**
 * Runtime type for thread access mode updates.
 */
export type SetThreadAccessModeParams = Schema.Schema.Type<typeof SetThreadAccessModeParams>
export type SetThreadAccessModeResult = Schema.Schema.Type<typeof SetThreadAccessModeResult>

/**
 * Runtime type for delete-thread parameters.
 */
export type DeleteThreadParams = Schema.Schema.Type<typeof DeleteThreadParams>

/**
 * Runtime type for delete-thread results.
 */
export type DeleteThreadResult = Schema.Schema.Type<typeof DeleteThreadResult>

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
export type ThreadAccessMode = Schema.Schema.Type<typeof ThreadAccessMode>
export type ProviderApprovalDecision = Schema.Schema.Type<typeof ProviderApprovalDecision>
export type ProviderPendingApproval = Schema.Schema.Type<typeof ProviderPendingApproval>
export type RespondToProviderApprovalParams = Schema.Schema.Type<typeof RespondToProviderApprovalParams>
export type RespondToProviderApprovalResult = Schema.Schema.Type<typeof RespondToProviderApprovalResult>

/**
 * Runtime type for provider events.
 */
export type ProviderRuntimeEvent = Schema.Schema.Type<typeof ProviderRuntimeEvent>

/**
 * Runtime type for orchestration domain events.
 */
export type OrchestrationDomainEvent = Schema.Schema.Type<typeof OrchestrationDomainEvent>
