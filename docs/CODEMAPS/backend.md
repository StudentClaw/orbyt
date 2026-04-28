<!-- Generated: 2026-04-27 | Files scanned: 15 | Token estimate: ~480 -->

# Backend Services Codemap

## API Routes (WebSocket RPC Methods)

**Base File**: `/packages/server/src/ws/Router.ts`

| Method | Handler | Purpose | Params |
|--------|---------|---------|--------|
| `server.getBootstrap` | `handleServerMethod()` | Desktop init data | none |
| `server.getConfig` | `handleServerMethod()` | App version, capabilities, chat models | none |
| `server.subscribeLifecycle` | `subscribeLifecycle()` | Stream server welcome events | none |
| `server.subscribeConfig` | `subscribeConfig()` | Stream config changes | none |

### Orchestration (Chat)
| Method | Handler | Params Schema |
|--------|---------|---------------|
| `orchestration.getSnapshot` | `handleOrchestrationMethod()` | — |
| `orchestration.createWorkspace` | `handleCreateWorkspace()` | `CreateWorkspaceParams` (rootPath) |
| `orchestration.createThread` | `handleCreateThread()` | `CreateThreadParams` (workspaceId, title) |
| `orchestration.renameThread` | `handleRenameThread()` | `RenameThreadParams` (threadId, title) |
| `orchestration.setThreadAccessMode` | `handleSetThreadAccessMode()` | `SetThreadAccessModeParams` (threadId, accessMode) |
| `orchestration.deleteThread` | `handleDeleteThread()` | `DeleteThreadParams` (threadId) |
| `orchestration.sendTurn` | `handleSendTurn()` | `SendTurnParams` (threadId, content, attachments, skillId, model) |
| `orchestration.interruptTurn` | `handleInterruptTurn()` | `InterruptTurnParams` (threadId) |
| `orchestration.relink/deleteWorkspace` | Workspace handlers | workspace CRUD |

### Canvas Integration
| Method | Handler | Purpose |
|--------|---------|---------|
| `canvas.listCourses` | `handleCanvasMethod()` | Get cached courses |
| `canvas.getMyUpcomingAssignments` | ↑ | Get assignments due in N days |
| `canvas.getMySubmissionStatus` | ↑ | Get pending/overdue submissions |
| `canvas.getMyCourseGrades` | ↑ | Get letter grades by course |
| `canvas.getMyTodoItems` | ↑ | Get Canvas TODO items |
| `canvas.getAssignmentDetails` | ↑ | Get rubric + submission details |
| `canvas.sync` | ↑ | Trigger manual Canvas sync |

### Provider (AI Runtime)
| Method | Handler | Purpose |
|--------|---------|---------|
| `provider.startAuth` | `handleProviderMethod()` | Begin Codex auth flow |
| `provider.retryInitialize` | ↑ | Retry provider connect |
| `provider.respondToApproval` | ↑ | User decision on approval request |

### Onboarding
| Method | Handler | Purpose |
|--------|---------|---------|
| `onboarding.getSnapshot` | `handleOnboardingMethod()` | Step status + overall state |
| `onboarding.setStepStatus` | ↑ | Mark step complete/pending |
| `onboarding.setOverallStatus` | ↑ | Mark onboarding done |
| `onboarding.getPreferences` | ↑ | Get study times, course ranking, etc. |
| `onboarding.setPreferences` | ↑ | Update user preferences |
| `onboarding.getRoutines` | ↑ | Get study routine grid |
| `onboarding.setRoutines` | ↑ | Set study routine cells |
| `onboarding.getDna` | ↑ | Get student archetype + card weights |
| `onboarding.classifyDna` | ↑ | Classify answers → archetype |
| `onboarding.getAiAuth` | ↑ | Get AI auth status |
| `onboarding.setAiAuth` | ↑ | Update AI auth state |

### Skills Management
| Method | Handler | Purpose |
|--------|---------|---------|
| `skills.list` | `handleSkillsMethod()` | List available skills |
| `skills.fork` | `handleForkSkill()` | Fork a skill to custom |
| `skills.grantCapability` | `handleGrantSkillCapability()` | Grant capability flag |
| `skills.revokeCapability` | `handleRevokeSkillCapability()` | Revoke capability |

### Activity & Dashboard
| Method | Handler | Purpose |
|--------|---------|---------|
| `activity.subscribeFeed` | `handleStreamMethod()` | Subscribe to activity feed updates |
| `activity.generateWeeklyInsight` | `handleActivityMethod()` | Generate AI insights from activity |
| `activity.setActed` | ↑ | Mark activity as acted upon |
| `dashboard.refresh` | `handleDashboardMethod()` | Trigger dashboard update push |
| `dashboard.subscribeUpdates` | `handleStreamMethod()` | Subscribe to dashboard changes |

### Memory & Developer
| Method | Handler | Purpose |
|--------|---------|---------|
| `memorize.run` | `handleMemorizeMethod()` | Trigger manual memorize run |
| `dev.resetSoft` | `handleDevMethod()` | Reset onboarding to pending |
| `dev.resetHard` | ↑ | Full reset including auth |

## Service Classes

### OrchestrationService
**File**: `/packages/server/src/orchestration/OrchestrationService.ts`

**Key Methods**:
- `getSnapshot()` → OrchestrationSnapshot (all workspaces, threads, turns)
- `createWorkspace(requestId: string, rootPath: string)` → CreateWorkspaceResult
- `sendTurn(requestId, threadId, content, attachments, model)` → SendTurnResult
- `startProviderAuth(requestId)` → StartProviderAuthResult
- `respondToProviderApproval(requestId, approvalId, decision)` → RespondToProviderApprovalResult

**Dependencies**: 
- CodexCli (provider)
- ThreadRuntimeManager
- ProviderRuntimeStore
- Database
- PushBus

**Key Data Queries**:
```sql
SELECT * FROM workspaces       -- OrchestrationWorkspace rows
SELECT * FROM threads WHERE workspace_id = ?
SELECT * FROM turns WHERE thread_id = ?
SELECT * FROM turn_attachments WHERE turn_id = ?
```

### CanvasSyncService
**File**: `/packages/server/src/canvas/CanvasSyncService.ts`

**Key Methods**:
- `sync()` → void (fetches from Canvas API, caches locally)
- `listCourses()` → Course[]
- `getMyUpcomingAssignments(days)` → Assignment[]
- `getMySubmissionStatus(courseId)` → SubmissionStatus
- `getMyCourseGrades()` → GradeSummary[]

**External API**: Canvas REST API (via PluginGateway)

**Database Tables**:
- `courses` (id, code, name, color, term)
- `assignments` (id, course_id, title, due_at, points)
- `submission_status` (assignment_id, status, submitted_at)

### CodexCli
**File**: `/packages/server/src/ai/CodexCli.ts`

**Key Methods**:
- `sendTurn(threadId, turnId, content, attachments)` → Promise<void> (streams via event bus)
- `interrupt(threadId, turnId)` → void

**Streams Events** via TurnEventBus:
- `provider.token` — each LLM token
- `provider.reasoning` — extended thinking tokens
- `provider.turnCompleted` — final output
- `provider.approvalRequested` — user approval needed

### MemorizeService
**File**: `/packages/server/src/memory/service.ts`

**Key Methods**:
- `runIfNeeded(now, options)` → MemorizeOutcome
- Generates daily/weekly memory entries
- Writes to `memory_graph_path` (external JSON structure)

**Database Tables**:
- `memory_distillations` (id, turn_id, distilled_content, created_at)
- `memory_summaries` (id, week, summary, created_at)

## Database Schema (Key Tables)

**Orchestration**:
```
workspaces (id, kind, name, root_path, availability, created_at)
threads (id, workspace_id, title, access_mode, status, current_turn_id, created_at)
turns (id, thread_id, input_text, output_text, reasoning_text, status, started_at, completed_at)
turn_attachments (id, turn_id, path, name, mime_type, size_bytes, kind)
```

**User**:
```
user_preferences (id, study_times, course_ranking, max_session_mins, 
                  quiet_hours_start, quiet_hours_end, memory_graph_path, ...)
onboarding_state (step_name, status, completed_at)
student_dna (id, archetype_id, trait, tagline, ..., stats, ...)
card_weights (card_id, weight, updated_at)
routines (day_of_week, hour_of_day)
```

**Canvas**:
```
courses (id, code, name, color, term)
assignments (id, course_id, title, due_at, points_possible)
submission_status (assignment_id, status, submitted_at)
course_grades (course_id, grade, letter_grade)
```

**System**:
```
ai_auth_state (id, status, provider, connected_at)
onboarding_answers (id, payload, updated_at)
activities (id, workflow_id, action, timestamp)
cron_jobs (id, schedule, next_run, enabled)
```

## Dependency Injection (Effect.js)

**File**: `/packages/server/src/index.ts`

**Core Layer**: ConfigService, Database, ServerReadiness, PushBus, SkillResolver
**Provider Layer**: CodexCli, ProviderRuntimeStore, PluginGateway
**Orchestration Layer**: OrchestrationService + all above
**Canvas Layer**: CanvasSyncService + Gateway
**Memory Layer**: MemorizeService + Provider

Layers merged via `Layer.mergeAll()` and `Layer.provide()`.

## Error Handling

- **Param validation**: `decodeParams()` returns schema error message
- **Framework errors**: Caught in `routeMessage()` try-catch → `encodeError()`
- **Close codes**: 1007 (invalid frame) on parse/envelope errors

**Error Response**:
```json
{ "kind": "response", "id": "...", "ok": false, 
  "error": { "code": "invalid_params", "message": "..." } }
```
