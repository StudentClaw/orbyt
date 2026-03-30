# Architecture Layer: Shared Contracts

## What It Is

The Shared Contracts package is the type-safe glue between every other layer. It defines the domain schemas (Course, Assignment, Grade, etc.), the WebSocket message protocol, and the typed error hierarchy — all using Effect Schema. Both the React UI and the Effect-TS server import from this single source of truth. Nothing crosses a boundary without being validated against a shared contract.

---

## Why It Exists

In a three-tier architecture where the UI, server, and plugins all speak to each other, type drift is the silent killer. If the server adds a field to `Assignment` and the UI doesn't know about it, things break silently. Shared Contracts prevent this by making the compiler enforce agreement between all layers at build time.

This is a pattern borrowed directly from T3 Code (pingdotgg), adapted for Effect Schema instead of Zod.

---

## Technology: Effect Schema

Effect Schema was chosen over Zod/Yup/io-ts because:

- **Dual-direction**: Schemas define both encoding (TS → JSON) and decoding (JSON → TS) with full type inference
- **Composability**: Schemas compose with Effect pipes, same as the rest of the Effect-TS stack
- **Branded types**: `CourseId`, `AssignmentId` are branded strings — you can't accidentally pass a CourseId where an AssignmentId is expected
- **Transformation**: Parse and transform in one step (e.g., string dates → Date objects during decode)
- **Error messages**: Structured parse errors that can be surfaced in the UI

---

## What Lives Here

### 1. Domain Schemas

Core data types shared across the entire application.

| Schema | Key Fields | Used By |
|---|---|---|
| `CourseId` | Branded string | Canvas, Dashboard, Memory |
| `AssignmentId` | Branded string | Canvas, Dashboard, Skills |
| `SkillId` | Branded string | Skill System |
| `Course` | name, code, professor, canvasId, term | Canvas, Dashboard, Memory |
| `Assignment` | title, dueDate, status, grade, courseId, pointsPossible | Canvas, Dashboard, Skills, Priority Queue |
| `Grade` | courseId, assignmentId, score, maxScore, letterGrade, postedAt | Canvas, Dashboard, Grade Chart |
| `StudyPlan` | blocks[], calendar events, estimates | Plan-Mode, Calendar View |
| `MemoryEntry` | content, scope, source, createdAt, confidence | Memory System |
| `Extension` | id, name, version, status, permissions | Plugin System, Extension Manager |
| `StudentPreference` | studyTimes, courseRanking, notificationPrefs | Memory, Onboarding |

### 2. WebSocket Protocol

Every message between the React UI and the Local Server is typed.

**Client → Server (requests):**
| Message | Purpose |
|---|---|
| `chat.sendMessage` | Student sends a chat message |
| `chat.interrupt` | Student clicks Stop during streaming |
| `canvas.sync` | Trigger immediate Canvas sync |
| `canvas.getCourses` | Request course list |
| `skills.activate` | Activate a skill by ID |
| `skills.planMode.start` | Start plan-mode flow |
| `dashboard.refresh` | Request fresh dashboard data |

**Server → Client (push events):**
| Message | Purpose |
|---|---|
| `chat.streaming` | Streaming token chunk (sequenced) |
| `chat.complete` | AI response finished |
| `chat.toolCall` | AI is calling a tool (show in UI) |
| `canvas.syncProgress` | Background sync progress update |
| `assignment.alert` | New assignment or grade detected |
| `dashboard.update` | Dashboard data changed |

### 3. Typed Errors

Errors are values in Effect-TS, tracked in the type system.

| Error | When It Occurs |
|---|---|
| `CanvasAuthError` | Canvas token is invalid or expired |
| `CanvasApiError` | Canvas REST API returned an error |
| `CodexSpawnError` | Codex CLI failed to start |
| `CodexTimeoutError` | AI response took too long |
| `JsonRpcParseError` | Malformed JSON-RPC message |
| `PluginStartError` | MCP plugin failed to initialize |
| `VaultDecryptError` | Credential decryption failed |
| `MemoryWriteError` | Failed to persist a memory |
| `SchemaDecodeError` | Incoming data didn't match expected schema |

---

## Proposed File Structure

```
packages/shared/
  package.json
  tsconfig.json
  src/
    schemas/
      ids.ts                  # CourseId, AssignmentId, SkillId (branded)
      course.ts               # Course schema
      assignment.ts           # Assignment schema
      grade.ts                # Grade schema
      study-plan.ts           # StudyPlan schema
      memory-entry.ts         # MemoryEntry schema
      extension.ts            # Extension/Plugin schema
      student-preference.ts   # StudentPreference schema
    protocol/
      messages.ts             # Union type of all WS messages
      client-messages.ts      # Client → Server message schemas
      server-events.ts        # Server → Client push event schemas
      rpc.ts                  # JSON-RPC envelope schema
    errors/
      canvas-errors.ts
      ai-errors.ts
      plugin-errors.ts
      memory-errors.ts
      schema-errors.ts
    index.ts                  # Barrel export
```

---

## Open Questions

- **Versioning**: When schemas evolve between app versions, how do we handle backward compatibility with data already stored in SQLite?
- **Runtime validation boundary**: Should every WebSocket message be validated on both sides (send and receive), or trust the sender and only validate on receive?
- **Error codes**: Should typed errors carry machine-readable codes for the UI to pattern-match on, or are the discriminated union tags enough?
