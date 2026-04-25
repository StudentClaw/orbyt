import { Schema } from "@effect/schema"
import {
  CanvasAssignmentDetailsResult,
  CanvasArchiveAssignmentResult,
  CanvasCourseContentOverviewResult,
  CanvasCourseStructureResult,
  CanvasDownloadCourseFileResult,
  CanvasGetMyCourseGradesResult,
  CanvasGetMyPeerReviewsTodoResult,
  CanvasGetMySubmissionStatusResult,
  CanvasGetMyTodoItemsResult,
  CanvasGetMyUpcomingAssignmentsResult,
  CanvasListAssignmentsResult,
  CanvasListCoursesResult,
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
  type CanvasAssignmentDetailsParams,
  type CanvasCourseContentOverviewParams,
  type CanvasCourseStructureParams,
  type CanvasDownloadCourseFileParams,
  type CanvasStudentCourseGradeSummary,
  type CanvasStudentPeerReviewTodo,
  type CanvasStudentTodoItem,
  type Course,
  type CourseWorkItem,
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
  type TurnReferenceInput,
  type UpdatePreferencesParams,
  type MemoryUpdatedEvent,
  type WeeklyInsight,
  SkillsListResult,
  ForkSkillResult,
  GrantCapabilityResult,
  type ForkSkillParams,
  type GrantCapabilityParams,
  type SkillSummary,
  type SkillId,
} from "@orbyt/contracts"
import type {
  DeleteThreadResult,
  RenameThreadResult,
} from "@orbyt/contracts"
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

function tryDecode<Value, Encoded>(
  schema: Schema.Schema<Value, Encoded, never>,
  value: unknown,
  context: string,
): Value | null {
  try {
    return Schema.decodeUnknownSync(schema)(value)
  } catch (error) {
    console.error(`Failed to decode ${context} push payload`, error)
    return null
  }
}

const CanvasSyncProgressPayload = Schema.Struct({
  courseId: Schema.String,
  progress: Schema.Number,
  status: Schema.Literal("syncing", "done", "error"),
})

const DashboardUpdatePayload = Schema.Struct({
  section: Schema.String,
})

const PlannerSessionCheckInPayload = Schema.Struct({
  sessionId: Schema.String,
  triggeredAt: Schema.String,
})

/**
 * Canvas sync progress payload emitted over the runtime push channel.
 */
export type CanvasSyncProgressEvent = Schema.Schema.Type<typeof CanvasSyncProgressPayload>

/**
 * Dashboard refresh payload emitted over the runtime push channel.
 */
export type DashboardUpdateEvent = Schema.Schema.Type<typeof DashboardUpdatePayload>

/**
 * Planner check-in payload emitted over the runtime push channel.
 */
export type PlannerSessionCheckInEvent = Schema.Schema.Type<typeof PlannerSessionCheckInPayload>

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
      skillId?: string | null,
      references?: readonly TurnReferenceInput[],
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
    readonly listCourses: () => Promise<ReadonlyArray<Course>>
    readonly getMyUpcomingAssignments: (days?: number) => Promise<ReadonlyArray<CourseWorkItem>>
    readonly getMySubmissionStatus: (
      courseId?: string,
    ) => Promise<{
      readonly submitted: ReadonlyArray<CourseWorkItem>
      readonly pending: ReadonlyArray<CourseWorkItem>
      readonly overdue: ReadonlyArray<CourseWorkItem>
    }>
    readonly getMyCourseGrades: () => Promise<ReadonlyArray<CanvasStudentCourseGradeSummary>>
    readonly getMyTodoItems: () => Promise<ReadonlyArray<CanvasStudentTodoItem>>
    readonly getMyPeerReviewsTodo: (courseId?: string) => Promise<ReadonlyArray<CanvasStudentPeerReviewTodo>>
    readonly getAssignmentDetails: (params: CanvasAssignmentDetailsParams) => Promise<Schema.Schema.Type<typeof CanvasAssignmentDetailsResult>>
    readonly listAssignments: (params: { courseId?: string; includeCompleted?: boolean }) => Promise<Schema.Schema.Type<typeof CanvasListAssignmentsResult>>
    readonly archiveAssignment: (assignmentId: string) => Promise<Schema.Schema.Type<typeof CanvasArchiveAssignmentResult>>
    readonly getCourseContentOverview: (params: CanvasCourseContentOverviewParams) => Promise<Schema.Schema.Type<typeof CanvasCourseContentOverviewResult>>
    readonly getCourseStructure: (params: CanvasCourseStructureParams) => Promise<Schema.Schema.Type<typeof CanvasCourseStructureResult>>
    readonly downloadCourseFile: (params: CanvasDownloadCourseFileParams) => Promise<Schema.Schema.Type<typeof CanvasDownloadCourseFileResult>>
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
  readonly memory: {
    readonly onMemoryUpdated: (
      listener: (event: MemoryUpdatedEvent) => void,
      options?: StreamSubscriptionOptions,
    ) => () => void
  }
  readonly skills: {
    readonly list: () => Promise<SkillsListResult>
    readonly fork: (params: ForkSkillParams) => Promise<{ skill: SkillSummary }>
    readonly grantCapability: (
      params: GrantCapabilityParams,
    ) => Promise<{ skillId: SkillId; grantedCapabilities: readonly string[] }>
    readonly revokeCapability: (
      params: GrantCapabilityParams,
    ) => Promise<{ skillId: SkillId; grantedCapabilities: readonly string[] }>
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
    sendTurn: async (threadId, content, attachments, model, skillId, references) =>
      transport.request<SendTurnResult>(RPC_METHODS.ORCHESTRATION_SEND_TURN, {
        threadId,
        content,
        attachments,
        ...(model ? { model } : {}),
        ...(skillId ? { skillId } : {}),
        ...(references && references.length > 0 ? { references } : {}),
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
    listCourses: async () =>
      decode(
        CanvasListCoursesResult,
        await transport.request(RPC_METHODS.CANVAS_LIST_COURSES, {}),
      ).courses,
    getMyUpcomingAssignments: async (days) =>
      decode(
        CanvasGetMyUpcomingAssignmentsResult,
        await transport.request(RPC_METHODS.CANVAS_GET_MY_UPCOMING_ASSIGNMENTS, days === undefined ? {} : { days }),
      ).items,
    getMySubmissionStatus: async (courseId) =>
      decode(
        CanvasGetMySubmissionStatusResult,
        await transport.request(
          RPC_METHODS.CANVAS_GET_MY_SUBMISSION_STATUS,
          courseId ? { courseId } : {},
        ),
      ),
    getMyCourseGrades: async () =>
      decode(
        CanvasGetMyCourseGradesResult,
        await transport.request(RPC_METHODS.CANVAS_GET_MY_COURSE_GRADES, {}),
      ).courses,
    getMyTodoItems: async () =>
      decode(
        CanvasGetMyTodoItemsResult,
        await transport.request(RPC_METHODS.CANVAS_GET_MY_TODO_ITEMS, {}),
      ).items,
    getMyPeerReviewsTodo: async (courseId) =>
      decode(
        CanvasGetMyPeerReviewsTodoResult,
        await transport.request(
          RPC_METHODS.CANVAS_GET_MY_PEER_REVIEWS_TODO,
          courseId ? { courseId } : {},
        ),
      ).items,
    getAssignmentDetails: async (params) =>
      decode(
        CanvasAssignmentDetailsResult,
        await transport.request(RPC_METHODS.CANVAS_GET_ASSIGNMENT_DETAILS, params),
      ),
    listAssignments: async (params) =>
      decode(
        CanvasListAssignmentsResult,
        await transport.request(RPC_METHODS.CANVAS_LIST_ASSIGNMENTS, params),
      ),
    archiveAssignment: async (assignmentId) =>
      decode(
        CanvasArchiveAssignmentResult,
        await transport.request(RPC_METHODS.CANVAS_ARCHIVE_ASSIGNMENT, { assignmentId }),
      ),
    getCourseContentOverview: async (params) =>
      decode(
        CanvasCourseContentOverviewResult,
        await transport.request(RPC_METHODS.CANVAS_GET_COURSE_CONTENT_OVERVIEW, params),
      ),
    getCourseStructure: async (params) =>
      decode(
        CanvasCourseStructureResult,
        await transport.request(RPC_METHODS.CANVAS_GET_COURSE_STRUCTURE, params),
      ),
    downloadCourseFile: async (params) =>
      decode(
        CanvasDownloadCourseFileResult,
        await transport.request(RPC_METHODS.CANVAS_DOWNLOAD_COURSE_FILE, params),
      ),
    sync: () => transport.request(RPC_METHODS.CANVAS_SYNC, {}).then(() => undefined),
    onSyncProgress: (listener, options) =>
      transport.subscribe(
        PUSH_CHANNELS.CANVAS_SYNC_PROGRESS,
        RPC_METHODS.CANVAS_SUBSCRIBE_SYNC_PROGRESS,
        (push) => {
          const event = tryDecode(CanvasSyncProgressPayload, push.data, "canvas sync progress")
          if (event) listener(event)
        },
        options,
      ),
  }
}

function createDashboardApi(transport: WsTransport): WsRpcClient["dashboard"] {
  return {
    refresh: () => transport.request(RPC_METHODS.DASHBOARD_REFRESH, {}).then(() => undefined),
    onUpdate: (listener, options) =>
      transport.subscribe(
        PUSH_CHANNELS.DASHBOARD_UPDATE,
        RPC_METHODS.DASHBOARD_SUBSCRIBE_UPDATES,
        (push) => {
          const event = tryDecode(DashboardUpdatePayload, push.data, "dashboard update")
          if (event) listener(event)
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
          const event = tryDecode(
            PlannerSessionCheckInPayload,
            push.data,
            "planner session check-in",
          )
          if (event) listener(event)
        },
        options,
      ),
  }
}

function createMemoryApi(transport: WsTransport): WsRpcClient["memory"] {
  return {
    onMemoryUpdated: (listener, options) =>
      transport.subscribe(
        PUSH_CHANNELS.MEMORY_UPDATED,
        RPC_METHODS.MEMORY_SUBSCRIBE_UPDATES,
        (push) => {
          listener(push.data as MemoryUpdatedEvent)
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

function createSkillsApi(transport: WsTransport): WsRpcClient["skills"] {
  return {
    list: async () => decode(SkillsListResult, await transport.request(RPC_METHODS.SKILLS_LIST, {})),
    fork: async (params) =>
      decode(ForkSkillResult, await transport.request(RPC_METHODS.SKILLS_FORK, params)),
    grantCapability: async (params) =>
      decode(GrantCapabilityResult, await transport.request(RPC_METHODS.SKILLS_GRANT_CAPABILITY, params)),
    revokeCapability: async (params) =>
      decode(GrantCapabilityResult, await transport.request(RPC_METHODS.SKILLS_REVOKE_CAPABILITY, params)),
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
    skills: createSkillsApi(transport),
    memory: createMemoryApi(transport),
    reconnect: () => transport.reconnect(),
    dispose: () => transport.dispose(),
  }
}
