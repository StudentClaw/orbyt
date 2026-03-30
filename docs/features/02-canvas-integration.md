# Feature 2: Canvas Integration

## What It Is

Canvas Integration is the bridge between Student Claw and the student's Canvas LMS instance. It's implemented as an MCP server plugin (not baked into the core), making it the first and most important plugin in the ecosystem. It discovers courses, tracks assignments, retrieves grades, scrapes announcements, and learns how each professor uses Canvas differently.

---

## Why It Exists

Canvas is where students live. Every assignment, grade, announcement, and due date flows through it. But Canvas's own UI is notoriously hard to navigate — things are buried in Modules, Files, or Announcements depending on the professor. Student Claw makes all of that accessible through conversation and a unified dashboard.

---

## Dependencies

```
Plugin System ──→ Canvas Integration ──→ Canvas LMS REST API
Shared Contracts ──→ Canvas Integration (Course, Assignment, Grade schemas)
```

| Depends On | Why |
|---|---|
| **Plugin System** | Canvas runs as an MCP server plugin, managed by the Orchestrator |
| **Shared Contracts** | Uses `Course`, `Assignment`, `Grade`, `Announcement` schemas |
| **Local Vault** | Canvas API token stored encrypted via Electron safeStorage |

| Depended On By | Why |
|---|---|
| **Dashboard** | Grade charts, deadline countdowns, assignment lists all come from Canvas data |
| **Smart Planner** | Assignment data, deadlines, and grade weights feed into task analysis and scheduling |
| **Skill System / Plan-Mode** | "Plan my week" needs to know what assignments are due |
| **Notification Service** | Change events (`AssignmentAdded`, `GradePosted`, etc.) trigger notifications |
| **Memory System** | Professor pattern learning depends on Canvas sync data |
| **Onboarding** | The credential wizard sets up Canvas access |

---

## Core Responsibilities

### 1. Course Discovery

On first sync (and periodically after), discover all active courses the student is enrolled in.

- Call Canvas REST API: `GET /api/v1/courses?enrollment_state=active`
- Map to `Course` schema: name, code, professor, term, Canvas ID
- Detect new courses, dropped courses, term changes

### 2. Assignment Tracking

The most critical data flow. Fetch all assignments across all courses and keep them current.

- `GET /api/v1/courses/:id/assignments` — full assignment list per course
- Track: title, description, due date, points possible, submission status, grade
- Diff against local SQLite to detect new assignments, changed due dates, new grades
- Handle the "professor didn't use Assignments" edge case (see Professor Patterns below)

### 3. Grade Retrieval

Pull current grades at course and assignment level.

- `GET /api/v1/courses/:id/enrollments` — course-level grades
- `GET /api/v1/courses/:id/assignments/:id/submissions/self` — per-assignment grades
- Calculate: current grade, projected grade, grade trend (improving/declining)

### 4. Announcement Scraping

Professors post important information in Announcements that students often miss.

- `GET /api/v1/courses/:id/discussion_topics?only_announcements=true`
- Extract: title, body, posted date, attachments
- Surface in Dashboard as a feed and make searchable by the AI

### 5. Background Sync

Canvas data shouldn't only refresh when the student asks. It should stay current. The sync service runs in the Effect-TS server (not in the MCP server itself).

**Adaptive sync interval:**
- **Active mode** (app window focused): every 15 minutes
- **Tray mode** (app minimized to system tray): every 60 minutes
- Configurable by the student in preferences

**Sync process:**
- Smart sync: only fetch what's changed since last sync (use `If-Modified-Since` or Canvas's `updated_at`)
- Maintain a local snapshot in SQLite (last known state of assignments, grades, deadlines)
- Diff new API response against snapshot
- Push updates to UI via WebSocket: `canvas.syncProgress`, `assignment.alert`

**Typed Change Events:**

When the sync detects differences, it emits typed events that other features subscribe to:

| Event | Trigger | Consumed By |
|---|---|---|
| `AssignmentAdded` | New assignment detected in any course | Notification Service, Smart Planner, Dashboard |
| `DeadlineChanged` | Due date modified on an existing assignment | Notification Service, Smart Planner |
| `GradePosted` | New score/grade appears on a submission | Notification Service, Dashboard |
| `AnnouncementPosted` | New announcement in any course | Notification Service, Dashboard |

These events are the primary integration point between Canvas and the [Notification Service](10-notification-service.md).

### 6. Professor Pattern Learning

This is where Student Claw gets smart. Different professors use Canvas differently.

- **Detection**: During sync, notice when a professor posts assignments in Modules instead of Assignments, or uses Pages for syllabi, or posts links in Announcements
- **Storage**: Write patterns to the Memory System: `{ professor: "Dr. Smith", pattern: "posts_in_modules", confidence: 0.8 }`
- **Adaptation**: On future syncs, check Modules/Pages/Files for professors known to use them
- **Feedback loop**: When the AI finds something via a pattern, increase confidence. When it doesn't, decrease.

---

## MCP Server Implementation

Canvas Integration is an MCP server, meaning it exposes tools that the AI can call.

### Exposed Tools

| Tool | Description | Parameters |
|---|---|---|
| `get_courses` | List all active courses | none |
| `get_assignments` | Get assignments for a course (or all courses) | `courseId?`, `status?`, `dueAfter?` |
| `get_upcoming` | Get assignments due in the next N days | `days` (default: 7) |
| `get_grades` | Get grades for a course | `courseId` |
| `get_announcements` | Get recent announcements | `courseId?`, `limit?` |
| `get_assignment_detail` | Get full detail for a specific assignment | `assignmentId` |
| `sync_now` | Trigger an immediate full sync | none |

### MCP Protocol

The Canvas MCP server communicates with the Orchestrator via stdio (stdin/stdout) using the MCP protocol:

- **Initialize**: Handshake with capabilities declaration
- **tools/list**: Return available tools
- **tools/call**: Execute a tool and return results
- Runs in an Electron `utilityProcess` for isolation

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

```
courses
  id, canvasId, name, code, professor, term, lastSyncAt

assignments
  id, courseId, canvasId, title, description, dueDate, pointsPossible,
  submissionStatus, grade, gradePostedAt, lastSyncAt

announcements
  id, courseId, canvasId, title, body, postedAt, lastSyncAt

professor_patterns
  id, courseId, professor, pattern, confidence, detectedAt, lastConfirmedAt

canvas_sync_log
  id, entityType, entityId, changeType, oldValue (JSON), newValue (JSON),
  detectedAt, notified (boolean)
```

The `canvas_sync_log` table records every detected change, enabling the Notification Service to process events even if the app was closed when the change was detected.

---

## Technology

| Library | Purpose |
|---|---|
| `@modelcontextprotocol/sdk` | Official MCP TypeScript SDK for server scaffold |
| Canvas REST API v1 | Well-documented, stable API |
| `keytar` or Electron `safeStorage` | Encrypted token storage |
| Effect-TS `Schedule` | Configurable polling intervals for background sync |

---

## Key Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Canvas API rate limits** | Typically 700 requests per 10 minutes, varies by institution | Conservative sync: batch requests, respect rate limit headers, back off on 403 |
| **Pagination** | Large courses can have hundreds of assignments | Proper Link-header pagination handling, fetch all pages before diffing |
| **Non-standard Canvas instances** | Some institutions customize Canvas heavily | Defensive parsing, graceful handling of missing/unexpected fields |

---

## Proposed File Structure

```
packages/extensions/canvas-mcp/
  index.ts              # MCP server entry point
  manifest.json         # Plugin metadata and permissions
  canvas-client.ts      # Canvas REST API wrapper
  sync-engine.ts        # Background sync logic, diffing
  pattern-detector.ts   # Professor pattern learning
  tools/
    get-courses.ts
    get-assignments.ts
    get-upcoming.ts
    get-grades.ts
    get-announcements.ts
    sync-now.ts
```

---

## Open Questions

- **Offline resilience**: When Canvas is unreachable, how stale can local data be before we warn the student?
- **Multi-institution**: Could a student be enrolled at two universities simultaneously? Does the data model support multiple Canvas instances?
- **Canvas notifications vs. our notifications**: Canvas already sends email notifications. Should Student Claw duplicate or replace those? See [Notification Service](10-notification-service.md) for the notification strategy.
