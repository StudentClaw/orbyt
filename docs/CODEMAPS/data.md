<!-- Generated: 2026-04-27 | Files scanned: 14 | Token estimate: ~380 -->

# Data Contracts & Schemas Codemap

## Shared Types (Effect/Schema)

**Location**: `/packages/contracts/src/`

All types use `@effect/schema` for validation + encoding/decoding. TypeScript types exported via `Schema.Schema.Type<typeof X>`.

## Protocol Definitions

**File**: `/packages/contracts/src/protocol/orchestration.ts`

### Identifiers (Branded Strings)
```typescript
WorkspaceId    // Unique chat workspace
ThreadId       // Chat thread within workspace
TurnId         // Single turn (user input + AI output)
CommandId      // Runtime command receipt
```

### RPC Method Constants
```typescript
RPC_METHODS = {
  // Server lifecycle
  SERVER_GET_BOOTSTRAP
  SERVER_GET_CONFIG
  SERVER_SUBSCRIBE_LIFECYCLE
  SERVER_SUBSCRIBE_CONFIG
  
  // Orchestration (chat)
  ORCHESTRATION_GET_SNAPSHOT
  ORCHESTRATION_CREATE_WORKSPACE
  ORCHESTRATION_CREATE_THREAD
  ORCHESTRATION_SEND_TURN
  ORCHESTRATION_INTERRUPT_TURN
  ORCHESTRATION_SUBSCRIBE_DOMAIN
  
  // Canvas
  CANVAS_LIST_COURSES
  CANVAS_GET_MY_UPCOMING_ASSIGNMENTS
  CANVAS_GET_MY_SUBMISSION_STATUS
  CANVAS_GET_MY_COURSE_GRADES
  CANVAS_SYNC
  CANVAS_SUBSCRIBE_SYNC_PROGRESS
  
  // Provider (AI)
  PROVIDER_START_AUTH
  PROVIDER_RESPOND_TO_APPROVAL
  PROVIDER_SUBSCRIBE_RUNTIME
  
  // Onboarding
  ONBOARDING_GET_SNAPSHOT
  ONBOARDING_SET_STEP_STATUS
  ONBOARDING_CLASSIFY_DNA
  ONBOARDING_GET_PREFERENCES
  ONBOARDING_SET_PREFERENCES
  
  // Skills, Activity, Memory, Dashboard
  SKILLS_LIST
  ACTIVITY_GENERATE_WEEKLY_INSIGHT
  MEMORIZE_RUN
  DASHBOARD_REFRESH
  DASHBOARD_SUBSCRIBE_UPDATES
}
```

### Push Channels (Server → Client)
```typescript
PUSH_CHANNELS = {
  SERVER_LIFECYCLE           // Server welcome
  ORCHESTRATION_DOMAIN       // Thread/turn events
  PROVIDER_RUNTIME           // Token streaming
  CANVAS_SYNC_PROGRESS       // Sync status
  DASHBOARD_UPDATE           // Grade/assignment changes
  ACTIVITY_FEED              // Activity notifications
  MEMORY_UPDATED             // Memorize job results
}
```

## Core Schema Definitions

### RPC Envelope
```typescript
RpcRequestEnvelope {
  kind: "request"
  id: string
  method: string
  params?: unknown
}

RpcSuccessResponseEnvelope {
  kind: "response"
  id: string
  ok: true
  result: unknown
}

RpcErrorResponseEnvelope {
  kind: "response"
  id: string
  ok: false
  error: { code: string, message: string }
}
```

### Orchestration State

**OrchestrationWorkspace**:
```typescript
{
  id: WorkspaceId
  kind: "filesystem" | "legacy"
  name: string
  rootPath: string (filesystem) | null (legacy)
  availability: "ready" | "missing" (filesystem)
  createdAt: ISO string
  updatedAt: ISO string
}
```

**OrchestrationThread**:
```typescript
{
  id: ThreadId
  workspaceId: WorkspaceId
  title: string
  accessMode: "default" | "full"
  status: "idle" | "queued" | "streaming" | "completed"
  createdAt: ISO string
  currentTurnId: TurnId | null
}
```

**OrchestrationTurn**:
```typescript
{
  id: TurnId
  threadId: ThreadId
  input: string         // User message
  output: string        // AI response
  reasoning: string     // Extended thinking (if enabled)
  status: "queued" | "streaming" | "interrupted" | "completed"
  startedAt: ISO string
  completedAt: ISO string | null
  skill: { id: SkillId, name: string } | null
  attachments: OrchestrationTurnAttachment[]
}
```

**OrchestrationTurnAttachment**:
```typescript
{
  id: string
  path: string          // Local file path
  name: string          // Display name
  mimeType: string | null
  sizeBytes: number | null
  kind: "image" | "file"
}
```

**OrchestrationSnapshot** (full state):
```typescript
{
  workspaces: OrchestrationWorkspace[]
  threads: OrchestrationThread[]
  turns: OrchestrationTurn[]
  pendingApprovals: ProviderPendingApproval[]
  providerStatus: ProviderRuntimeStatus
  providerRuntime: ProviderRuntimeState
  chatSendReady: boolean
  ready: boolean
  lastSequence: number
}
```

### Provider (AI) Events

**ProviderRuntimeStatus**:
```typescript
"idle" | "streaming" | "interrupted" | "offline" | "initializing" 
| "auth_required" | "degraded" | "rate_limited"
```

**ProviderRuntimeEvent** (Union of):
```typescript
{ type: "provider.stateChanged", state: ProviderRuntimeState }
{ type: "provider.token", threadId, turnId, token, index }
{ type: "provider.reasoning", threadId, turnId, token, index }
{ type: "provider.turnCompleted", threadId, turnId, output }
{ type: "provider.approvalRequested", approval: ProviderPendingApproval }
{ type: "provider.approvalResolved", approvalRequestId, decision }
{ type: "provider.mcpToolCall", threadId, turnId, toolName, status }
```

### Canvas Integration

**Course**:
```typescript
{
  id: string
  code: string          // "ECON 101"
  name: string          // "Introduction to Economics"
  color?: string        // Hex color
  term: string
}
```

**CourseWorkItem** (Assignment):
```typescript
{
  id: string
  courseId: string
  title: string
  pointsPossible?: number
  effectiveDueAt?: ISO string
  submissionStatus?: string     // "submitted" | "unsubmitted" | "graded"
  grade?: string | number
  htmlUrl?: string              // Canvas link
}
```

**CanvasStudentCourseGradeSummary**:
```typescript
{
  courseId: string
  gradingScheme: string         // "A-F" | "0-100"
  grade: string                 // "A" | "87.5"
  letterGrade?: string
}
```

### Onboarding & Student Profile

**StudentDna** (Archetype):
```typescript
{
  archetypeId: string
  trait: string                 // Descriptor
  tagline: string
  icon: string
  hue: number                   // 0-360
  accentHue: number
  isRare: boolean
  rarity: string                // "common" | "rare" | "mythic"
  stats: Record<string, number> // Custom stats
  peak: string                  // Best time to study
  style: string                 // Learning style
  motivation: string
  name: string                  // Archetype name
  aiPromptHint: string          // Hint for AI tutor
  recommendedFeatures: string[] // Suggested tools
  sentimentAnchors: string[]    // Study mood keywords
  orbytAdapts: string           // How system adapts
}
```

**StudentPreference**:
```typescript
{
  studyTimes: string[]          // ["9:00 AM", "2:00 PM"]
  courseRanking: string[]       // Course IDs in priority order
  maxSessionMins: number
  offLimitDays: number[]        // 0=Sun, 6=Sat
  notificationEnabled: boolean
  quietHoursStart: string       // "22:00"
  quietHoursEnd: string         // "08:00"
  calendarIntegration: string   // "none" | "google" | "apple"
  memoryGraphPath: string | null
  defaultAccessMode: "default" | "full"
}
```

**CardWeight** (DNA card importance):
```typescript
{
  cardId: string
  weight: number                // 0-1 scale
}
```

### Request/Response Params

**CreateWorkspaceParams**:
```typescript
{ rootPath: string }
```

**SendTurnParams**:
```typescript
{
  threadId: ThreadId
  content: string               // ≤16,384 chars
  attachments: TurnAttachmentInput[]
  skillId?: SkillId             // Optional skill context
  model?: ChatModelId           // Optional model override
}
```

**ClassifyDnaParams**:
```typescript
{
  answers: Record<string, unknown>  // Quiz responses
}
```

**SetThreadAccessModeParams**:
```typescript
{
  threadId: ThreadId
  accessMode: "default" | "full"
}
```

## Server Configuration

**ServerConfig**:
```typescript
{
  appVersion: string            // "0.1.0"
  platform: string              // "darwin" | "linux" | "win32"
  protocolVersion: string       // "1"
  capabilities: {
    orchestration: boolean
    providerRuntime: boolean
    desktopBootstrap: boolean
  }
  defaultChatModel: string
  chatModels: ChatModel[]
  featureFlags: FeatureFlags
}
```

**ChatModel**:
```typescript
{
  id: ChatModelId               // "gpt-5.4" | "gpt-5.4-mini"
  label: string
  description: string
  group: "standard" | "reasoning"
}
```

## Domain Events

**OrchestrationDomainEvent** (Union of):
```typescript
{ type: "workspace.created", workspace: OrchestrationWorkspace }
{ type: "workspace.updated", workspace: OrchestrationWorkspace }
{ type: "thread.created", thread: OrchestrationThread }
{ type: "thread.updated", thread: OrchestrationThread }
{ type: "turn.queued", turn: OrchestrationTurn }
{ type: "turn.started", turn: OrchestrationTurn }
{ type: "turn.updated", turn: OrchestrationTurn }
{ type: "turn.completed", turn: OrchestrationTurn }
{ type: "turn.interrupted", turn: OrchestrationTurn }
```

## Activities & Insights

**ActivityFeedEntry**:
```typescript
{
  id: string
  workflowId: string            // "assignment_submitted", etc.
  action: string
  timestamp: ISO string
  metadata?: Record<string, unknown>
}
```

**WeeklyInsight**:
```typescript
{
  id: string
  week: string                  // "2026-W17"
  title: string
  summary: string               // Generated AI insight
  createdAt: ISO string
}
```

## External Service Contracts

**PluginGateway** (MCP):
- Invokes: Canvas API, Codex CLI, custom plugins
- Response: structured by plugin spec

**CanvasAPI**:
- GET /courses
- GET /courses/:id/assignments
- GET /courses/:id/students/submissions
- GET /users/self/grades_summary

**CodexCli**:
- Spawned as subprocess
- Input: JSON stdin
- Output: streaming JSON events (tokens, reasoning, tool calls)
