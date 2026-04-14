# Architecture Layer: Shared Contracts

## What It Is

The shared contract layer is the type-safe glue between every other layer. `packages/contracts` is the canonical source of truth for schemas, protocol messages, and typed errors; `packages/shared` is an ergonomic re-export layer for app consumers that should not define competing boundary contracts. Both the React UI and the Effect-TS server import from this source of truth. Nothing crosses a boundary without being validated against a shared contract.

---

## Why It Exists

In a three-tier architecture where the UI, server, and plugins all speak to each other, type drift is the silent killer. If the server adds a field to `Assignment` and the UI doesn't know about it, things break silently. Shared Contracts prevent this by making the compiler enforce agreement between all layers at build time.

This is a pattern borrowed directly from T3 Code (pingdotgg), adapted for Effect Schema instead of Zod.

---

## Technology: Effect Schema

Effect Schema was chosen over Zod/Yup/io-ts because:

- **Dual-direction**: Schemas define both encoding (TS → JSON) and decoding (JSON → TS) with full type inference
- **Composability**: Schemas compose with Effect pipes, same as the rest of the Effect-TS stack
- **Branded types**: `CourseId`, `CourseWorkItemId` are branded strings — you can't accidentally pass a CourseId where a coursework item ID is expected
- **Transformation**: Parse and transform in one step (e.g., string dates → Date objects during decode)
- **Error messages**: Structured parse errors that can be surfaced in the UI

---

## What Lives Here

### 1. Domain Schemas

Core data types shared across the entire application.

| Schema | Key Fields | Used By |
|---|---|---|
| `CourseId` | Branded string | Canvas, Dashboard, Memory |
| `CourseWorkItemId` | Branded string | Canvas, Planner, Dashboard |
| `SkillId` | Branded string | Skill System |
| `Course` | name, code, professor, canvasId, term | Canvas, Dashboard, Memory |
| `CourseWorkItem` | title, effectiveDueAt, sourceType, sourceId, freshnessStatus | Canvas, Planner, Dashboard |
| `Grade` | courseId, assignmentId, score, maxScore, letterGrade, postedAt | Canvas, Dashboard, Grade Chart |
| `PlannedSession` | taskId, startTime, endTime, status, completionNote | Planner, Dashboard, Notifications |
| `ActivityFeedEntry` | category, type, title, body, priority, deepLink | Notifications, Dashboard Activity Center |
| `MemoryEntry` | content, scope, source, createdAt, confidence | Memory System |
| `ExtensionManifest` / `ExtensionRegistryEntry` | manifest metadata, install source, lifecycle status, auth, tool summaries | Plugin System, Extension Manager |
| `StudentPreference` | studyTimes, courseRanking, notificationPrefs, quietHours | Memory, Onboarding, Notifications |
| `OnboardingState` | step, status, completedAt | Onboarding |

### 2. Transport Contracts (WebSocket + IPC)

All cross-boundary messages are typed. Student Claw uses:

- **WebSocket contracts** for real-time domain streams and chat
- **IPC contracts** for Electron shell/native capabilities and preload-bridged desktop flows

**WebSocket Client → Server (requests):**
| Message | Purpose |
|---|---|
| `chat.sendMessage` | Student sends a chat message |
| `chat.interrupt` | Student clicks Stop during streaming |
| `canvas.sync` | Trigger immediate Canvas sync |
| `canvas.getCourses` | Request course list |
| `skills.activate` | Activate a skill by ID |
| `skills.planMode.start` | Start plan-mode flow |
| `dashboard.refresh` | Request fresh dashboard data |
| `planner.reschedule` | Request task/session move or conflict resolution |
| `preferences.updateCoursePriority` | Persist conversational course-priority updates |

**WebSocket Server → Client (push events):**
| Message | Purpose |
|---|---|
| `chat.streaming` | Streaming token chunk (sequenced) |
| `chat.complete` | AI response finished |
| `chat.toolCall` | AI is calling a tool (show in UI) |
| `canvas.syncProgress` | Background sync progress update |
| `activity.feedUpsert` | Unified feed entry (canvas/planner/workflow/insight) |
| `planner.sessionCheckIn` | Check-in prompt signal for session completion |
| `dashboard.update` | Dashboard data changed |

**IPC Renderer ↔ Main (selected channels):**

| Channel | Direction | Purpose |
|---|---|---|
| `file:open-dialog` | Renderer → Main | Open native file picker |
| `file:save-dialog` | Renderer → Main | Open native save dialog |
| `notification:show` | Renderer/Server → Main | Trigger native OS notification |
| `plugin:list` | Renderer → Main | Read the registry snapshot for installed/discovered extensions |
| `plugin:install-bundled` | Renderer → Main | Install a bundled extension |
| `plugin:set-enabled` | Renderer → Main | Enable or disable an installed extension |
| `plugin:uninstall` | Renderer → Main | Remove an installed extension |
| `plugin:get-status` | Renderer → Main | Read a single extension lifecycle snapshot |
| `plugin:lifecycle` | Main → Renderer | Push extension lifecycle status changes |
| `plugin:tool-call` | Server/Main bridge | Execute MCP tool through Electron Plugin Orchestrator |
| `plugin:tools-changed` | Main → Server | Notify server that plugin tool inventory changed |
| `dashboard:open-chat-panel` | Renderer local event | Slide-over chat launch from dashboard quick actions |

### 3. Typed Errors

Errors are values in Effect-TS, tracked in the type system.

| Error | When It Occurs |
|---|---|
| `CanvasAuthError` | Canvas token is invalid or expired |
| `CanvasApiError` | Canvas REST API returned an error |
| `CodexSpawnError` | Codex CLI failed to start |
| `CodexTimeoutError` | AI response took too long |
| `ExtensionManifestValidationError` | A manifest failed shared-schema validation |
| `JsonRpcParseError` | Malformed JSON-RPC message |
| `PluginStartError` | MCP plugin failed to initialize |
| `PluginAuthError` | Plugin credential/auth handshake failed |
| `PluginRegistryMismatchError` | Registry state drifted from the expected plugin identity or metadata |
| `VaultDecryptError` | Credential decryption failed |
| `MemoryWriteError` | Failed to persist a memory |
| `SchemaDecodeError` | Incoming data didn't match expected schema |
| `PolicyDeniedError` | Requested skill/planner/plugin capability blocked by policy gate |
| `PluginToolCallError` | Plugin tool execution failed or timed out |

---

## Proposed File Structure

```
packages/contracts/
  package.json
  tsconfig.json
  src/
    schemas/
      ids.ts                  # CourseId, CourseWorkItemId, SkillId (branded)
      course.ts               # Course schema
      coursework-item.ts      # CourseWorkItem schema
      grade.ts                # Grade schema
      planned-session.ts      # PlannedSession schema
      activity-feed-entry.ts  # Activity feed schema
      memory-entry.ts         # MemoryEntry schema
      extension.ts            # Extension/Plugin schema
      student-preference.ts   # StudentPreference schema
      onboarding-state.ts     # Onboarding wizard state
    protocol/
      messages.ts             # Union type of all WS messages
      client-messages.ts      # Client → Server message schemas
      server-events.ts        # Server → Client push event schemas
      ipc-channels.ts         # Renderer ↔ Main IPC schemas
      rpc.ts                  # JSON-RPC envelope schema (internal/plugin)
    errors/
      canvas-errors.ts
      ai-errors.ts
      plugin-errors.ts
      memory-errors.ts
      schema-errors.ts
    index.ts                  # Canonical barrel export

packages/shared/
  src/
    index.ts                  # Thin re-export layer over canonical contracts + shared runtime
```

---

## Open Questions

- **Versioning**: When schemas evolve between app versions, how do we handle backward compatibility with data already stored in SQLite?
- **Runtime validation boundary**: Should every WebSocket message be validated on both sides (send and receive), or trust the sender and only validate on receive?
- **Error codes**: Should typed errors carry machine-readable codes for the UI to pattern-match on, or are the discriminated union tags enough?
