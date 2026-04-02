# Feature 2: Canvas Integration

## What It Is

Canvas Integration is the bridge between Student Claw and the student's Canvas LMS instance. It is implemented as a **Student Claw-owned TypeScript MCP plugin** plus server-side sync orchestration. The MCP owns Canvas-specific API access and normalization; the local server owns scheduling, caching, diffing, memory feedback, and downstream reactions. It discovers courses, normalizes coursework into a shared `CourseWorkItem` model, retrieves grades, pulls announcements, and learns how each course actually uses Canvas over time.

---

## Why It Exists

Canvas is where students live. Every assignment, grade, announcement, and due date flows through it. But Canvas's own UI is notoriously hard to navigate — things are buried in Modules, Files, or Announcements depending on the professor. Student Claw makes all of that accessible through conversation and a unified dashboard.

---

## Dependencies

```text
Plugin System ──→ Canvas Integration ──→ Canvas LMS REST API
Local Server ───→ Canvas Integration (scheduling, caching, diffing, event fan-out)
Shared Contracts ──→ Canvas Integration (Course, CourseWorkItem, Grade, Announcement schemas)
```

| Depends On | Why |
| --- | --- |
| **Plugin System** | Canvas runs as an MCP server plugin, managed by the Orchestrator |
| **Local Server** | Owns background sync scheduling, local cache, change detection, and typed event emission |
| **Shared Contracts** | Uses `Course`, `CourseWorkItem`, `Grade`, `Announcement` schemas |
| **Local Vault** | Canvas API token stored encrypted via Electron safeStorage |

| Depended On By | Why |
| --- | --- |
| **Dashboard** | Grade charts, deadline countdowns, assignment lists all come from Canvas data |
| **Smart Planner** | `CourseWorkItem` data, deadlines, and grade weights feed into task analysis and scheduling |
| **Skill System / Plan-Mode** | "Plan my week" needs to know what assignments are due |
| **Notification Service** | Change events (`AssignmentAdded`, `GradePosted`, etc.) trigger notifications |
| **Memory System** | Professor pattern learning depends on Canvas sync data |
| **Onboarding** | The credential wizard sets up Canvas access |

---

## Core Responsibilities

### 1. Course Discovery

On first sync (and periodically after), discover all active courses the student is enrolled in.

- Call Canvas REST API: `GET /api/v1/users/self/courses?enrollment_state=active&include[]=teachers&include[]=term`
- Map to `Course` schema: name, code, professor, term, Canvas ID
- Detect new courses, dropped courses, term changes
- v1 supports **one Canvas instance per Student Claw profile**, but the local schema remains forward-compatible with a future `canvas_accounts` table for multi-instance support

### 2. Coursework Normalization

The most critical data flow. Fetch coursework across all courses and normalize it into a single planner-friendly shape.

**Primary source**:

- `GET /api/v1/courses/:id/assignments`

**Selective secondary sources**:

- `GET /api/v1/courses/:course_id/modules` and module item endpoints
- `GET /api/v1/courses/:course_id/pages`
- `GET /api/v1/announcements?context_codes[]=course_{id}`

Everything is normalized into `CourseWorkItem`, which contains:

- title
- normalized description / summary
- `effectiveDueAt`
- provenance (`sourceType`, `sourceId`, `sourceDueDateKind`)
- freshness metadata (`cachedAt`, `lastVerifiedAt`, `sourceUpdatedAt`, `freshnessStatus`)
- slim raw source snapshot for debugging / re-parsing

**Interpretation rules**:

- Official Canvas assignments always become `CourseWorkItem`s
- Work inferred from Modules / Pages / Announcements also becomes `CourseWorkItem`s when it is clearly plan-eligible, especially when a due date is present
- If the student deletes an inferred item, that becomes a memory feedback signal to reduce trust in similar detections for that course / source pattern
- If an inferred item later appears as an official Canvas assignment, merge automatically when the match is high-confidence and preserve the official record as canonical

### 3. Grade Retrieval

Pull current grades at course and assignment level.

- `GET /api/v1/courses/:id/enrollments` — course-level grades
- `GET /api/v1/courses/:id/assignments/:id/submissions/self` — per-assignment grades
- Calculate: current grade, projected grade, grade trend (improving/declining)

### 4. Announcement Scraping

Professors post important information in Announcements that students often miss.

- Preferred endpoint: `GET /api/v1/announcements?context_codes[]=course_{id}`
- Extract: title, body, posted date, attachments
- Surface in the unified activity feed and make searchable by the AI
- Announcement content is also a secondary discovery source for plan-eligible `CourseWorkItem`s when professors hide work outside the Assignments tab

### 5. Background Sync

Canvas data should not refresh only when the student asks. It should stay current. The **sync scheduler lives in the Effect-TS server**, not inside the MCP.

**Adaptive sync interval:**

- **Active mode** (app window focused): every 15 minutes
- **Tray mode** (app minimized to system tray): every 60 minutes
- Configurable by the student in preferences

**Read model:**

- `get_coursework` is **cache-first** by default
- The tool can optionally refresh based on arguments like `refresh: "never" | "if_stale" | "force"`
- Normal reminder-style chat queries should usually stay local and cheap

**Freshness policy:**

- Crossing midnight marks coursework as **soft-stale**, not invalid
- Per-course pattern memory raises or lowers refresh urgency based on how that course usually posts work
- The planner may do a short bounded wait for high-risk stale courses before finalizing a weekly plan

**Sync process:**

- Metadata-first refresh: poll thin assignment/coursework metadata before re-fetching full detail
- Use source fields like `updated_at` and `due_at` to detect likely changes
- Maintain a local snapshot in SQLite (last known coursework, grades, deadlines, provenance, freshness)
- Diff new normalized results against the snapshot in the server
- Push updates to UI via WebSocket / feed events: `canvas.syncProgress`, planner changes, notifications, autonomous workflow triggers

**Typed Change Events:**

When the sync detects differences, it emits typed events that other features subscribe to:

| Event | Trigger | Consumed By |
| --- | --- | --- |
| `AssignmentAdded` | New assignment detected in any course | Notification Service, Smart Planner, Dashboard |
| `DeadlineChanged` | Due date modified on an existing assignment | Notification Service, Smart Planner |
| `GradePosted` | New score/grade appears on a submission | Notification Service, Dashboard |
| `AnnouncementPosted` | New announcement in any course | Notification Service, Dashboard |

These events are the primary integration point between Canvas and the [Notification Service](10-notification-service.md), and they also serve as triggers for user-defined autonomous workflows that run on the server.

### 6. Professor Pattern Learning

This is where Student Claw gets smart. Different professors use Canvas differently.

- **Detection**: During sync, notice when a course posts work in Modules instead of Assignments, uses Pages heavily, or buries deadlines in Announcements
- **Storage**: Start with **course-level memory first**, for example `{ course: "BIO 201", pattern: "posts_in_modules", confidence: 0.8 }`
- **Promotion**: Promote to professor-level memory only after repeated confirmations across multiple courses or terms
- **Adaptation**: On future syncs, expand scans only for courses whose evidence or memory justifies it
- **Feedback loop**:
  - successful retrieval increases confidence
  - failed retrieval decreases confidence
  - user deletion of a bad inferred item lowers trust for that source pattern
  - user clarification like "this professor posts in Modules" becomes a strong memory signal

### 7. Clarification Loop

If Student Claw cannot confidently determine where a course's real work is posted:

- do **not** interrupt background sync with a blocking modal
- create a non-blocking prompt in chat / feed, e.g. "I’m not seeing new work in BIO 201 under Assignments. Does this professor usually post in Modules, Pages, Announcements, or somewhere else?"
- run a targeted retry once the student answers
- store the successful path in memory for future syncs

---

## MCP Server Implementation

Canvas Integration is an MCP server, meaning it exposes tools that the AI can call. The Canvas MCP owns Canvas-specific fetching and normalization; the server owns cache policy, scheduling, diffing, and downstream reactions.

### Exposed Tools

| Tool | Description | Parameters |
| --- | --- | --- |
| `get_courses` | List all active courses | none |
| `get_coursework` | Get normalized `CourseWorkItem`s from cache-backed Canvas data | `courseId?`, `sources?`, `dueAfter?`, `dueBefore?`, `includeCompleted?`, `refresh?` |
| `get_coursework_detail` | Get full detail for a specific coursework item or source object | `courseWorkItemId` |
| `get_grades` | Get grades for a course | `courseId` |
| `get_announcements` | Get recent announcements | `courseId?`, `limit?` |
| `sync_now` | Trigger an immediate full sync | none |

### MCP Protocol

The Canvas MCP server communicates with the Orchestrator via stdio (stdin/stdout) using the MCP protocol:

- **Initialize**: Handshake with capabilities declaration
- **tools/list**: Return available tools
- **tools/call**: Execute a tool and return results
- Implemented in TypeScript and packaged with the Student Claw app

---

## Canvas API Authentication

Canvas uses personal access tokens for API authentication.

- Token is generated by the student in Canvas: Settings > Approved Integrations > New Access Token
- Stored encrypted in the Local Vault (Electron safeStorage)
- Passed to the Canvas MCP server as an environment variable on spawn
- The Onboarding wizard walks students through generating this token step-by-step

### API Base URL

Each university has its own Canvas instance (e.g., `https://canvas.university.edu`). The student provides this during onboarding. Stored alongside the token in the Vault.

---

## Data Model (Local Cache)

Canvas data is cached in SQLite so the app works even when Canvas is slow or unreachable.

```text
canvas_accounts
  id, baseUrl, lastValidatedAt

courses
  id, canvasAccountId, canvasId, name, code, professor, term, lastSyncAt

coursework_items
  id, courseId, sourceType, sourceId, canonicalCanvasAssignmentId,
  title, description, effectiveDueAt, sourceDueDateKind,
  pointsPossible, submissionStatus, grade, gradePostedAt,
  cachedAt, lastVerifiedAt, sourceUpdatedAt, freshnessStatus,
  rawSourceSnapshot (JSON), deletedByUser (boolean), lastSyncAt

announcements
  id, courseId, canvasId, title, body, postedAt, lastSyncAt

course_patterns
  id, courseId, professor, pattern, confidence, detectedAt, lastConfirmedAt,
  source, promotedToProfessor (boolean)

canvas_sync_log
  id, entityType, entityId, changeType, oldValue (JSON), newValue (JSON),
  detectedAt, notified (boolean)
```

Key model choices:

- `CourseWorkItem` stores one **effective due date** for planner use, plus provenance about whether that date came from a base assignment date, override, or inference
- Each item stores a **slim raw source snapshot** so parsing mistakes can be debugged or improved later without always re-fetching Canvas
- `canvas_sync_log` records every detected change, enabling the Notification Service and autonomous workflow engine to replay missed events after downtime

---

## Technology

| Library | Purpose |
| --- | --- |
| `@modelcontextprotocol/sdk` | Official MCP TypeScript SDK for server scaffold |
| Canvas REST API v1 | Well-documented, stable API |
| `keytar` or Electron `safeStorage` | Encrypted token storage |
| Effect-TS `Schedule` | Configurable polling intervals for server-owned background sync |
| SQLite | Local cache, diffable snapshots, and event replay |

---

## Key Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **Canvas API throttling** | Dynamic request-cost throttling can slow or reject aggressive syncs | Keep reads cache-first, avoid broad parallel scans, inspect request-cost headers, back off on `429` |
| **Pagination** | Large courses can have hundreds of assignments, announcements, or pages | Proper Link-header pagination handling, shared pagination helper, fetch all pages before diffing |
| **Non-standard Canvas instances** | Some institutions customize Canvas heavily | Defensive parsing, graceful handling of missing/unexpected fields |
| **False-positive inferred coursework** | Planner could include work the student does not consider actionable | Use source provenance, allow deletion, write negative feedback to memory, merge inferred items into official ones when later confirmed |
| **Due date overrides / hidden dates** | Planner could act on the wrong due date | Normalize to one effective due date per student while preserving due-date provenance metadata |

---

## Proposed File Structure

```text
packages/extensions/canvas-mcp/
  index.ts              # MCP server entry point
  manifest.json         # Plugin metadata and permissions
  canvas-client.ts      # Canvas REST API wrapper
  normalizers/
    assignments.ts
    modules.ts
    pages.ts
    announcements.ts
  detail-fetchers/
    coursework-detail.ts
  tools/
    get-courses.ts
    get-coursework.ts
    get-coursework-detail.ts
    get-grades.ts
    get-announcements.ts
    sync-now.ts

packages/server/src/canvas/
  CanvasSyncService.ts      # Server-owned scheduling + sync orchestration
  CanvasDiffEngine.ts       # Snapshot diffing and typed event emission
  CourseWorkCache.ts        # SQLite persistence for courses / coursework / announcements
  FreshnessPolicy.ts        # Soft-stale logic, midnight rollover, per-course refresh scoring
  PatternFeedback.ts        # Memory writes from successful retrievals, deletions, and clarifications
```

---

## Open Questions

- **Offline resilience**: When Canvas is unreachable, how stale can cached coursework become before the UI should warn the student that they are looking at an offline snapshot?
- ~~**Multi-institution**~~: v1 supports one Canvas instance per Student Claw profile, but the schema stays forward-compatible with `canvas_accounts`. ✅
- ~~**Canvas notifications vs. our notifications**~~: Student Claw owns freshness checks and its own activity feed / notifications; Canvas notifications are not used as a source of truth for coursework freshness. ✅
