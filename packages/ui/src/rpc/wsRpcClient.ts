import { Schema } from "@effect/schema"
import {
  OrchestrationDomainEvent,
  OrchestrationSnapshot,
  ProviderRuntimeEvent,
  PUSH_CHANNELS,
  RPC_METHODS,
  ServerConfig,
  ServerConfigStreamEvent,
  ServerLifecycleEvent,
  type ActivityFeedEntry,
  type AiAuthState,
  type Course,
  type CreateWorkspaceResult,
  type CreateThreadResult,
  type DeleteWorkspaceResult,
  type DesktopBootstrap,
  type InterruptTurnResult,
  type OnboardingSnapshot,
  type PlannedSession,
  type RespondToProviderApprovalResult,
  type RelinkWorkspaceResult,
  type RetryProviderInitializeResult,
  type SendTurnResult,
  type SetThreadAccessModeResult,
  type StartProviderAuthResult,
  type ThreadAccessMode,
  type SetAiAuthStatusParams,
  type SetOverallStatusParams,
  type SetRoutinesParams,
  type SetStepStatusParams,
  type StudentPreference,
  type TurnAttachmentInput,
  type UpdatePreferencesParams,
  type WeeklyInsight,
} from "@student-claw/contracts"
import type {
  DeleteThreadResult,
  RenameThreadResult,
} from "@student-claw/contracts"
import { WsTransport } from "./wsTransport"

type StreamSubscriptionOptions = {
  readonly onResubscribe?: () => void
}

function decode<Value, Encoded>(
  schema: Schema.Schema<Value, Encoded, never>,
  value: unknown,
): Value {
  return Schema.decodeUnknownSync(schema)(value)
}

/**
 * Canvas sync progress payload emitted over the runtime push channel.
 */
export interface CanvasSyncProgressEvent {
  readonly courseId: string
  readonly progress: number
  readonly status: "syncing" | "done" | "error"
}

/**
 * Dashboard refresh payload emitted over the runtime push channel.
 */
export interface DashboardUpdateEvent {
  readonly section: string
}

/**
 * Planner check-in payload emitted over the runtime push channel.
 */
export interface PlannerSessionCheckInEvent {
  readonly sessionId: string
  readonly triggeredAt: string
}

/**
 * Activity feed upsert payload emitted over the runtime push channel.
 */
export type ActivityFeedUpsertEvent = ActivityFeedEntry

/**
 * Typed RPC client facade used by the renderer runtime state modules.
 */
export interface WsRpcClient {
  readonly transport: WsTransport
  readonly server: {
    readonly getBootstrap: () => Promise<DesktopBootstrap>
    readonly getConfig: () => Promise<ServerConfig>
    readonly subscribeLifecycle: (
      listener: (event: ServerLifecycleEvent) => void,
      options?: StreamSubscriptionOptions,
    ) => () => void
    readonly subscribeConfig: (
      listener: (event: ServerConfigStreamEvent) => void,
      options?: StreamSubscriptionOptions,
    ) => () => void
  }
  readonly orchestration: {
    readonly getSnapshot: () => Promise<OrchestrationSnapshot>
    readonly createWorkspace: (rootPath: string) => Promise<CreateWorkspaceResult>
    readonly relinkWorkspace: (workspaceId: string, rootPath: string) => Promise<RelinkWorkspaceResult>
    readonly deleteWorkspace: (workspaceId: string) => Promise<DeleteWorkspaceResult>
    readonly createThread: (workspaceId: string, title?: string) => Promise<CreateThreadResult>
    readonly renameThread: (threadId: string, title: string) => Promise<RenameThreadResult>
    readonly setThreadAccessMode: (
      threadId: string,
      accessMode: ThreadAccessMode,
    ) => Promise<SetThreadAccessModeResult>
    readonly deleteThread: (threadId: string) => Promise<DeleteThreadResult>
    readonly sendTurn: (
      threadId: string,
      content: string,
      attachments: readonly TurnAttachmentInput[],
      model?: string | null,
    ) => Promise<SendTurnResult>
    readonly interruptTurn: (threadId: string) => Promise<InterruptTurnResult>
    readonly onDomainEvent: (
      listener: (event: OrchestrationDomainEvent, sequence: number) => void,
      options?: StreamSubscriptionOptions,
    ) => () => void
  }
  readonly provider: {
    readonly startAuth: () => Promise<StartProviderAuthResult>
    readonly retryInitialize: () => Promise<RetryProviderInitializeResult>
    readonly respondToApproval: (
      approvalRequestId: string,
      decision: "approve" | "deny",
    ) => Promise<RespondToProviderApprovalResult>
    readonly onRuntimeEvent: (
      listener: (event: ProviderRuntimeEvent, sequence: number) => void,
      options?: StreamSubscriptionOptions,
    ) => () => void
  }
  readonly canvas: {
    readonly getCourses: () => Promise<ReadonlyArray<Course>>
    readonly sync: () => Promise<void>
    readonly onSyncProgress: (
      listener: (event: CanvasSyncProgressEvent) => void,
      options?: StreamSubscriptionOptions,
    ) => () => void
  }
  readonly dashboard: {
    readonly refresh: () => Promise<void>
    readonly onUpdate: (
      listener: (event: DashboardUpdateEvent) => void,
      options?: StreamSubscriptionOptions,
    ) => () => void
  }
  readonly planner: {
    readonly getSessions: () => Promise<ReadonlyArray<PlannedSession>>
    readonly checkIn: (sessionId: string, status: string, note?: string) => Promise<void>
    readonly onSessionCheckIn: (
      listener: (event: PlannerSessionCheckInEvent) => void,
      options?: StreamSubscriptionOptions,
    ) => () => void
  }
  readonly activity: {
    readonly generateWeeklyInsight: () => Promise<WeeklyInsight>
    readonly onFeedUpdate: (
      listener: (event: ActivityFeedUpsertEvent) => void,
      options?: StreamSubscriptionOptions,
    ) => () => void
  }
  readonly onboarding: {
    readonly getSnapshot: () => Promise<OnboardingSnapshot>
    readonly setStepStatus: (params: SetStepStatusParams) => Promise<{ ok: boolean }>
    readonly setOverallStatus: (params: SetOverallStatusParams) => Promise<{ ok: boolean }>
    readonly getPreferences: () => Promise<StudentPreference>
    readonly setPreferences: (params: UpdatePreferencesParams) => Promise<StudentPreference>
    readonly getRoutines: () => Promise<{ cells: Array<{ dayOfWeek: number; hourOfDay: number }> }>
    readonly setRoutines: (params: SetRoutinesParams) => Promise<{ count: number }>
    readonly getAiAuth: () => Promise<AiAuthState>
    readonly setAiAuth: (params: SetAiAuthStatusParams) => Promise<AiAuthState>
  }
  readonly dev: {
    readonly resetSoft: () => Promise<{ ok: boolean }>
    readonly resetHard: () => Promise<{ ok: boolean }>
  }
  readonly reconnect: () => Promise<void>
  readonly dispose: () => Promise<void>
}

function createServerApi(transport: WsTransport): WsRpcClient["server"] {
  return {
    getBootstrap: () => transport.request(RPC_METHODS.SERVER_GET_BOOTSTRAP, {}),
    getConfig: async () => decode(ServerConfig, await transport.request(RPC_METHODS.SERVER_GET_CONFIG, {})),
    subscribeLifecycle: (listener, options) =>
      transport.subscribe(
        PUSH_CHANNELS.SERVER_LIFECYCLE,
        RPC_METHODS.SERVER_SUBSCRIBE_LIFECYCLE,
        (push) => {
          listener(decode(ServerLifecycleEvent, push.data))
        },
        options,
      ),
    subscribeConfig: (listener, options) =>
      transport.subscribe(
        PUSH_CHANNELS.SERVER_CONFIG,
        RPC_METHODS.SERVER_SUBSCRIBE_CONFIG,
        (push) => {
          listener(decode(ServerConfigStreamEvent, push.data))
        },
        options,
      ),
  }
}

function createOrchestrationApi(transport: WsTransport): WsRpcClient["orchestration"] {
  return {
    getSnapshot: async () =>
      decode(OrchestrationSnapshot, await transport.request(RPC_METHODS.ORCHESTRATION_GET_SNAPSHOT, {})),
    createWorkspace: async (rootPath) =>
      transport.request<CreateWorkspaceResult>(RPC_METHODS.ORCHESTRATION_CREATE_WORKSPACE, { rootPath }),
    relinkWorkspace: async (workspaceId, rootPath) =>
      transport.request<RelinkWorkspaceResult>(RPC_METHODS.ORCHESTRATION_RELINK_WORKSPACE, {
        workspaceId,
        rootPath,
      }),
    deleteWorkspace: async (workspaceId) =>
      transport.request<DeleteWorkspaceResult>(RPC_METHODS.ORCHESTRATION_DELETE_WORKSPACE, { workspaceId }),
    createThread: async (workspaceId, title) =>
      transport.request<CreateThreadResult>(
        RPC_METHODS.ORCHESTRATION_CREATE_THREAD,
        title ? { workspaceId, title } : { workspaceId },
      ),
    renameThread: async (threadId, title) =>
      transport.request<RenameThreadResult>(RPC_METHODS.ORCHESTRATION_RENAME_THREAD, {
        threadId,
        title,
      }),
    setThreadAccessMode: async (threadId, accessMode) =>
      transport.request<SetThreadAccessModeResult>(RPC_METHODS.ORCHESTRATION_SET_THREAD_ACCESS_MODE, {
        threadId,
        accessMode,
      }),
    deleteThread: async (threadId) =>
      transport.request<DeleteThreadResult>(RPC_METHODS.ORCHESTRATION_DELETE_THREAD, { threadId }),
    sendTurn: async (threadId, content, attachments, model) =>
      transport.request<SendTurnResult>(RPC_METHODS.ORCHESTRATION_SEND_TURN, {
        threadId,
        content,
        attachments,
        ...(model ? { model } : {}),
      }),
    interruptTurn: async (threadId) =>
      transport.request<InterruptTurnResult>(RPC_METHODS.ORCHESTRATION_INTERRUPT_TURN, { threadId }),
    onDomainEvent: (listener, options) =>
      transport.subscribe(
        PUSH_CHANNELS.ORCHESTRATION_DOMAIN,
        RPC_METHODS.ORCHESTRATION_SUBSCRIBE_DOMAIN,
        (push) => {
          listener(decode(OrchestrationDomainEvent, push.data), push.sequence)
        },
        options,
      ),
  }
}

function createProviderApi(transport: WsTransport): WsRpcClient["provider"] {
  return {
    startAuth: () => transport.request<StartProviderAuthResult>(RPC_METHODS.PROVIDER_START_AUTH, {}),
    retryInitialize: () =>
      transport.request<RetryProviderInitializeResult>(RPC_METHODS.PROVIDER_RETRY_INITIALIZE, {}),
    respondToApproval: (approvalRequestId, decision) =>
      transport.request<RespondToProviderApprovalResult>(RPC_METHODS.PROVIDER_RESPOND_TO_APPROVAL, {
        approvalRequestId,
        decision,
      }),
    onRuntimeEvent: (listener, options) =>
      transport.subscribe(
        PUSH_CHANNELS.PROVIDER_RUNTIME,
        RPC_METHODS.PROVIDER_SUBSCRIBE_RUNTIME,
        (push) => {
          listener(decode(ProviderRuntimeEvent, push.data), push.sequence)
        },
        options,
      ),
  }
}

function createCanvasApi(transport: WsTransport): WsRpcClient["canvas"] {
  return {
    getCourses: () => transport.request(RPC_METHODS.CANVAS_GET_COURSES, {}),
    sync: () => transport.request(RPC_METHODS.CANVAS_SYNC, {}),
    onSyncProgress: (listener, options) =>
      transport.subscribe(
        PUSH_CHANNELS.CANVAS_SYNC_PROGRESS,
        RPC_METHODS.CANVAS_SUBSCRIBE_SYNC_PROGRESS,
        (push) => {
          listener(push.data as CanvasSyncProgressEvent)
        },
        options,
      ),
  }
}

function createDashboardApi(transport: WsTransport): WsRpcClient["dashboard"] {
  return {
    refresh: () => transport.request(RPC_METHODS.DASHBOARD_REFRESH, {}),
    onUpdate: (listener, options) =>
      transport.subscribe(
        PUSH_CHANNELS.DASHBOARD_UPDATE,
        RPC_METHODS.DASHBOARD_SUBSCRIBE_UPDATES,
        (push) => {
          listener(push.data as DashboardUpdateEvent)
        },
        options,
      ),
  }
}

function createPlannerApi(transport: WsTransport): WsRpcClient["planner"] {
  return {
    getSessions: () => transport.request(RPC_METHODS.PLANNER_GET_SESSIONS, {}),
    checkIn: (sessionId, status, note) =>
      transport.request(RPC_METHODS.PLANNER_CHECK_IN, { sessionId, status, note }),
    onSessionCheckIn: (listener, options) =>
      transport.subscribe(
        PUSH_CHANNELS.PLANNER_SESSION_CHECK_IN,
        RPC_METHODS.PLANNER_SUBSCRIBE_CHECK_INS,
        (push) => {
          listener(push.data as PlannerSessionCheckInEvent)
        },
        options,
      ),
  }
}

function createActivityApi(transport: WsTransport): WsRpcClient["activity"] {
  return {
    generateWeeklyInsight: () => transport.request(RPC_METHODS.ACTIVITY_GENERATE_WEEKLY_INSIGHT, {}),
    onFeedUpdate: (listener, options) =>
      transport.subscribe(
        PUSH_CHANNELS.ACTIVITY_FEED,
        RPC_METHODS.ACTIVITY_SUBSCRIBE_FEED,
        (push) => {
          listener(push.data as ActivityFeedUpsertEvent)
        },
        options,
      ),
  }
}

function createOnboardingApi(transport: WsTransport): WsRpcClient["onboarding"] {
  return {
    getSnapshot: () => transport.request(RPC_METHODS.ONBOARDING_GET_SNAPSHOT, {}),
    setStepStatus: (params) => transport.request(RPC_METHODS.ONBOARDING_SET_STEP_STATUS, params),
    setOverallStatus: (params) => transport.request(RPC_METHODS.ONBOARDING_SET_OVERALL_STATUS, params),
    getPreferences: () => transport.request(RPC_METHODS.ONBOARDING_GET_PREFERENCES, {}),
    setPreferences: (params) => transport.request(RPC_METHODS.ONBOARDING_SET_PREFERENCES, params),
    getRoutines: () => transport.request(RPC_METHODS.ONBOARDING_GET_ROUTINES, {}),
    setRoutines: (params) => transport.request(RPC_METHODS.ONBOARDING_SET_ROUTINES, params),
    getAiAuth: () => transport.request(RPC_METHODS.ONBOARDING_GET_AI_AUTH, {}),
    setAiAuth: (params) => transport.request(RPC_METHODS.ONBOARDING_SET_AI_AUTH, params),
  }
}

function createDevApi(transport: WsTransport): WsRpcClient["dev"] {
  return {
    resetSoft: () => transport.request(RPC_METHODS.DEV_RESET_SOFT, {}),
    resetHard: () => transport.request(RPC_METHODS.DEV_RESET_HARD, {}),
  }
}

/**
 * Creates a typed RPC client over the authenticated WebSocket transport.
 */
export function createWsRpcClient(transport: WsTransport): WsRpcClient {
  return {
    transport,
    server: createServerApi(transport),
    orchestration: createOrchestrationApi(transport),
    provider: createProviderApi(transport),
    canvas: createCanvasApi(transport),
    dashboard: createDashboardApi(transport),
    planner: createPlannerApi(transport),
    activity: createActivityApi(transport),
    onboarding: createOnboardingApi(transport),
    dev: createDevApi(transport),
    reconnect: () => transport.reconnect(),
    dispose: () => transport.dispose(),
  }
}
