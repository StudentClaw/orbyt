# Student Claw â€” V1 Dependency Trees & Implementation Plan

---

## Architecture Overview

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    Electron Shell                        â”‚
â”‚  Tray icon Â· Native notifications Â· Window management    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                         â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                  React + Vite UI                         â”‚
â”‚  Dashboard Â· Chat Â· Onboarding Â· Skill Editor            â”‚
â”‚                                                          â”‚
â”‚  â—„â”€â”€â”€â”€ WebSocket (JSON-RPC) â”€â”€â”€â”€â–º                        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                         â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚              Effect-TS Local Server                       â”‚
â”‚                                                          â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ AI Harness   â”‚  â”‚ Memory Engineâ”‚  â”‚ Background Svc â”‚  â”‚
â”‚  â”‚ (Codex mgr)  â”‚  â”‚ (Profile +   â”‚  â”‚ (Canvas poll + â”‚  â”‚
â”‚  â”‚              â”‚  â”‚  Vector DB)  â”‚  â”‚  State diff)   â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚         â”‚                 â”‚                   â”‚           â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ Codex App    â”‚  â”‚ SQLite       â”‚  â”‚ Canvas MCP     â”‚  â”‚
â”‚  â”‚ Server       â”‚  â”‚ (memory +    â”‚  â”‚ Server         â”‚  â”‚
â”‚  â”‚ (subprocess) â”‚  â”‚  vectors)    â”‚  â”‚ (subprocess)   â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚                                                          â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ Skills Loader Â· Planner Engine Â· Notification Svc   â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Feature Dependency Trees

Each feature below lists its internal components, what it depends on, what depends on it, and the specific tech/libraries needed.

---

### 1. AI Harness

The backbone. Every intelligent feature flows through this.

**Components:**
- Codex app-server subprocess manager (spawn, health check, restart, graceful shutdown)
- JSON-RPC client over stdio (initialize handshake, turn management, streaming events)
- Auth coordinator (ChatGPT OAuth via `account/login/start` + API key fallback)
- System prompt builder (compiles soul.md + active profile + active skills into system prompt)
- Context window budget manager (allocates token budget across: system prompt, profile, retrieved memory, conversation history, tool responses)
- MCP server registry (registers Canvas + any installed extensions with Codex)
- WebSocket bridge (translates Codex JSON-RPC events â†’ React UI events)
- Session lifecycle (thread create, turn submit, turn steer, turn interrupt, thread cleanup)

**Depends on:** Nothing (foundation layer)

**Depended on by:** Everything â€” Memory reads/writes, Planner, Personality, Skills, Notifications, Dashboard (chat), Onboarding (auth)

**Tech needed:**
- `codex` CLI (npm: `@openai/codex`) â€” installed as app dependency, bundled or prompted during onboarding
- Effect-TS `Stream` + `Queue` for handling JSONL event streams
- Effect Schema for typed JSON-RPC message contracts (generate from `codex app-server generate-json-schema`)
- Node `child_process` (Bun equivalent) for subprocess management
- `ws` or Bun native WebSocket for UI bridge

**Key risks:**
- Codex CLI versioning â€” app-server protocol may change between versions. Pin a known-good version.
- ChatGPT rate limits â€” students on Plus get limited Codex usage per 5-hour window. Need graceful degradation.
- Cold start latency â€” app-server initialization + auth takes seconds. Pre-warm on app launch, not on first user message.

---

### 2. Memory System

The AI's knowledge about the student. Read-heavy, with a nightly write pipeline.

**Components:**

```
memory/
â”œâ”€â”€ profile.md              â† Always-loaded compact summary (~500 tokens)
â”œâ”€â”€ soul.md                 â† Personality definition + learned interaction style
â”œâ”€â”€ long-term/
â”‚   â”œâ”€â”€ academic.md         â† Major, GPA goals, strengths, weaknesses
â”‚   â”œâ”€â”€ personal.md         â† Work schedule, life context
â”‚   â””â”€â”€ patterns.md         â† Learned behaviors ("skips Tuesday sessions")
â”œâ”€â”€ courses/
â”‚   â”œâ”€â”€ CS101/
â”‚   â”‚   â”œâ”€â”€ course.md       â† Syllabus summary, grading policy
â”‚   â”‚   â”œâ”€â”€ professor.md    â† How this professor uses Canvas, grading patterns
â”‚   â”‚   â””â”€â”€ assignments.md  â† Active assignments + notes
â”‚   â””â”€â”€ MATH200/
â”‚       â””â”€â”€ ...
â”œâ”€â”€ routines/
â”‚   â””â”€â”€ schedule.md         â† Recurring weekly blocks (classes, work, gym)
â”œâ”€â”€ preferences/
â”‚   â””â”€â”€ prefs.md            â† Explicit settings (quiet hours, break length, notification prefs)
â””â”€â”€ daily/
    â”œâ”€â”€ 2026-03-29.md       â† Today's log
    â”œâ”€â”€ 2026-03-28.md
    â””â”€â”€ ...
```

- **Profile compiler** â€” reads across all categories, generates a compact `profile.md` summary that's always injected into context. Regenerated on meaningful changes (not every interaction).
- **Vector index** â€” chunks all markdown files into embeddings, stores in SQLite via `sqlite-vec` or similar. Enables semantic search ("what did the professor say about late work?").
- **Memory retriever** â€” given a user query + current profile, runs semantic search and returns top-k relevant chunks from the appropriate categories. Budget-aware (respects token allocation from AI Harness).
- **Memory writer** â€” API for other systems to write memory (Canvas sync writes to courses/, planner writes to daily/, distillation writes to long-term/).
- **Daily distillation job** â€” end-of-day process: spins up Codex with the day's conversation log + current long-term memory, asks it to extract durable facts, update soul.md interaction style, and prune stale info. Writes updates back to markdown files + re-indexes vectors.

**Depends on:** AI Harness (for distillation job only â€” reads/writes are pure Effect-TS)

**Depended on by:** AI Harness (profile injection), Planner (routines + courses + preferences), Dashboard (progress data), Notifications (preferences), Soul/Personality (soul.md)

**Tech needed:**
- SQLite (via `better-sqlite3` or Bun's built-in `bun:sqlite`)
- `sqlite-vec` extension for vector search OR a lightweight JS vector lib (e.g., `vectra` for local vector DB)
- OpenAI Embeddings API (`text-embedding-3-small`) for generating vectors â€” this DOES require an API call separate from Codex CLI. Alternative: use a local embedding model to avoid API dependency, but quality tradeoff.
- Effect-TS `FileSystem` service for markdown read/write
- A chunking strategy (split markdown by heading sections, ~200-300 tokens per chunk)

**Key decisions needed:**
- **Embedding model**: OpenAI API (better quality, requires API key or separate auth) vs. local model (e.g., `onnxruntime` with a small model, zero external dependency). Recommendation: OpenAI embeddings for v1 since students already have auth. Revisit if offline mode becomes a requirement.
- **Profile regeneration trigger**: On every app launch? On memory write? On a timer? Recommendation: on app launch + after distillation job completes.
- **Daily log granularity**: Full conversation transcripts vs. AI-summarized interaction notes? Recommendation: summarized notes (cheaper storage, better retrieval quality, privacy-friendlier).

---

### 3. Soul / Personality System

What makes this a *companion* and not a generic chatbot.

**Components:**
- `soul.md` template â€” base personality traits, communication style, encouragement patterns, boundaries
- System prompt assembler â€” merges soul.md + learned adaptations into the system prompt on every Codex turn
- Interaction style tracker â€” during distillation, analyzes how the student communicates (casual? formal? emoji-heavy? terse?) and records adaptations in soul.md
- Tone calibration â€” the AI should match the student's energy but never lose its core personality (e.g., student is stressed â†’ empathetic but still encouraging, not panicked)

**Depends on:** AI Harness (system prompt injection), Memory System (soul.md storage, distillation pipeline)

**Depended on by:** Nothing directly â€” it's a cross-cutting concern that colors all AI output

**Tech needed:**
- No additional tech â€” this is system prompt engineering + the distillation job from Memory System
- A well-crafted `soul.md` template (this is a design task, not an engineering task)

**Key design notes:**
- soul.md should have two sections: **immutable core** (personality traits that never change) and **adaptive layer** (learned communication style that the distillation job can update)
- The immutable core prevents personality drift â€” without it, the distillation job could gradually turn the assistant into a mirror of the student's worst habits

---

### 4. Canvas MCP Server

The primary data source. Feeds into planner, dashboard, notifications.

**Components:**
- MCP server scaffold (stdio transport, tool registration, request handling)
- Canvas REST API client (courses, assignments, modules, syllabus, grades, announcements)
- Token storage (encrypted personal access token in SQLite)
- Tool definitions:
  - `canvas_get_courses` â€” list enrolled courses with metadata
  - `canvas_get_assignments` â€” assignments for a course, filterable by status/due date
  - `canvas_get_grades` â€” current grades per course
  - `canvas_get_syllabus` â€” course syllabus content
  - `canvas_get_modules` â€” module structure and items
  - `canvas_get_announcements` â€” recent announcements
  - `canvas_get_upcoming` â€” cross-course upcoming deadlines
- Background sync service (runs in Effect-TS server, NOT in the MCP server):
  - Polls Canvas API on a configurable interval (e.g., every 15 min when app is active, every hour in tray)
  - Maintains a local snapshot in SQLite (last known state of assignments, grades, deadlines)
  - Diffs new API response against snapshot
  - Emits typed change events: `AssignmentAdded`, `DeadlineChanged`, `GradePosted`, `AnnouncementPosted`
  - These events feed into the Notification Service

**Depends on:** SQLite (for token storage + sync snapshot)

**Depended on by:** AI Harness (registered as MCP server), Planner (assignment data), Dashboard (grades, deadlines), Notification Service (change events), Memory System (courses/ directory populated from Canvas data)

**Tech needed:**
- `@modelcontextprotocol/sdk` (official MCP TypeScript SDK) for server scaffold
- Canvas REST API v1 (well-documented, stable)
- `keytar` or Electron `safeStorage` for encrypted token storage
- Effect-TS `Schedule` for polling intervals

**Key risks:**
- Canvas API rate limits vary by institution (typically 700 requests per 10 minutes). Sync must be conservative.
- Canvas API pagination â€” assignment lists can be large. Need proper pagination handling.
- Some Canvas instances have non-standard configurations. Defensive parsing required.

---

### 5. Smart Planner

The flagship intelligence feature. Takes Canvas data + memory + preferences and produces a concrete study plan.

**Components:**
- **Task analyzer** â€” takes an assignment from Canvas and determines:
  - Importance score (weight in syllabus, percentage of grade, proximity to deadline)
  - Estimated time to complete (based on assignment type + historical data from memory)
  - Whether it needs splitting (>2 hours estimated â†’ multi-session)
  - Dependencies ("need to read Ch.5 before starting this problem set")
- **Task decomposer** â€” breaks large tasks into sub-sessions:
  - Exam studying â†’ spaced review sessions across multiple days
  - Research paper â†’ outline session, research session(s), writing session(s), review session
  - Uses course memory to understand what's actually involved
- **Slot finder** â€” queries routines memory for available time blocks, respects preferences (quiet hours, break requirements, max study duration)
- **Schedule builder** â€” places task sessions into available slots:
  - Respects deadlines (works backward from due date)
  - Prioritizes by importance score
  - Distributes cognitive load (doesn't stack 3 hard tasks on one day)
  - Leaves buffer time before deadlines
- **Reschedule engine:**
  - Student-initiated: receives "move this" or "can't do this tonight" â†’ finds alternative slots, ripple-adjusts downstream tasks
  - Event-driven: receives Canvas change event from Background Service â†’ evaluates impact â†’ adjusts plan if needed â†’ triggers notification
- **Completion handler** â€” processes the three completion states:
  - "Yes" â†’ mark session done, update daily memory, progress tracking
  - "No" â†’ reschedule the session, adjust downstream
  - "Yes, but..." â†’ capture student's note, partial reschedule, feed into daily memory for distillation

**Depends on:** AI Harness (Codex does the reasoning for analysis, decomposition, and natural-language rescheduling), Memory System (routines, preferences, course data, daily logs), Canvas MCP Server (assignment data, deadlines)

**Depended on by:** Dashboard (planned sessions, completion tracking), Notification Service (plan reminders, reschedule alerts)

**Tech needed:**
- The planner is primarily an AI-driven feature â€” Codex does the heavy reasoning
- But needs structured data layer in SQLite:
  - `planned_sessions` table (task_id, start_time, end_time, status, course_id, parent_task_id)
  - `tasks` table (canvas_assignment_id, importance_score, estimated_minutes, needs_splitting, deadline)
- Effect-TS `Schedule` for triggering plan evaluations
- The planner skill (markdown) that instructs Codex how to plan â€” this IS the plan-mode skill from the doc

**Key design decision:**
The planner walks a line between AI reasoning and deterministic logic. Recommendation:
- **AI handles**: task analysis, time estimation, decomposition, natural-language rescheduling explanations
- **Deterministic code handles**: slot finding, constraint checking (no double-booking), deadline validation, the actual calendar placement
- This hybrid approach prevents the AI from hallucinating impossible schedules

---

### 6. Dashboard

The student's command center. Visual + interactive.

**Components:**
- **Weekly calendar view** â€” shows planned study sessions from the Planner, color-coded by course. Tap a session to see details or trigger rescheduling.
- **Completion check-ins** â€” at the scheduled end of a session (or when student opens the app), show the three-way completion prompt: Yes / No / Yes, but...
- **Upcoming deadlines** â€” countdown cards for nearest deadlines, pulled from Canvas sync snapshot
- **Grade overview** â€” per-course current grade, pulled from Canvas. Simple bar or progress chart.
- **Weekly progress** â€” how many planned sessions completed vs. skipped this week. Streak tracking.
- **Proactive insight cards** â€” surfaced by the AI when relevant ("You have 3 deadlines next week â€” want to start planning?"). These come from the Notification Service.

**Depends on:** Canvas MCP Server (grades, deadlines), Planner (scheduled sessions, completion data), Memory System (progress history), Notification Service (insight cards)

**Depended on by:** Nothing â€” it's a leaf node (pure presentation + interaction)

**Tech needed:**
- React components (the UI layer)
- A charting library â€” lightweight, suggestion: `recharts` or `victory` for React
- WebSocket subscription to server events (real-time updates when Canvas syncs or plan changes)
- Effect Schema for typed WebSocket event contracts (shared between server and UI)

---

### 7. Proactive Notification Service

Bridges background intelligence to the student's attention.

**Components:**
- **Event listener** â€” subscribes to Canvas sync change events from Background Service
- **Notification evaluator** â€” decides whether a change is worth notifying about:
  - New assignment posted â†’ always notify
  - Deadline changed â†’ always notify
  - Grade posted â†’ always notify
  - Announcement posted â†’ notify if contains keywords (exam, deadline, cancellation)
  - Plan reminder â†’ notify at configured time before a planned session
- **Notification composer** â€” generates the notification text. For simple events (grade posted), use templates. For complex events (deadline moved, plan needs rescheduling), spin up Codex for a contextual message.
- **Delivery layer** â€” Electron `Notification` API for native OS notifications. Respects quiet hours from preferences memory.
- **Insight generator** â€” periodic (e.g., Sunday evening) proactive analysis: spin up Codex with the week's data and ask for insights/recommendations. Surface as cards on the dashboard.

**Depends on:** Canvas MCP Server (change events), Planner (session reminders), Memory System (preferences for quiet hours, notification settings), AI Harness (for contextual notification text and insights)

**Depended on by:** Dashboard (insight cards)

**Tech needed:**
- Electron `Notification` API (native OS notifications)
- `node-cron` or Effect-TS `Schedule` for timed reminders
- Notification queue in SQLite (to handle offline â†’ show on next app open)

---

### 8. Skills System

Extensibility layer for AI behavior.

**Components:**
- **Skill file spec** â€” markdown format definition:
  ```
  ---
  name: plan-mode
  description: Helps plan your week based on Canvas assignments
  trigger: auto | manual | keyword
  keywords: ["plan", "schedule", "week"]
  version: 1.0
  author: StudentClaw
  ---

  # Instructions
  (natural language instructions injected into AI context when active)
  ```
- **Skill loader** â€” reads skill files from the skills directory, parses frontmatter, builds a registry
- **Skill activator** â€” determines which skills to inject into the current Codex turn:
  - `auto` trigger: always active (e.g., personality baseline)
  - `keyword` trigger: activated when user message matches keywords
  - `manual` trigger: student explicitly enables/disables from UI
- **Bundled skills:**
  - `plan-mode` â€” the flagship planner skill
  - `study-helper` â€” study technique suggestions, Pomodoro-style session management
  - `essay-helper` â€” writing assistance, outline generation, citation reminders
  - `exam-prep` â€” spaced repetition scheduling, practice question generation
  - `explain-like` â€” adjusts explanation complexity ("explain like I'm 5" / "explain technically")
- **Skill editor UI** â€” simple markdown editor in the app where students can create/edit custom skills
- **Skill context budget** â€” skills compete for context window space. Active skills get allocated tokens from the AI Harness budget manager.

**Depends on:** AI Harness (context injection, budget management)

**Depended on by:** Planner (plan-mode skill), general AI responses

**Tech needed:**
- `gray-matter` or similar for markdown frontmatter parsing
- A simple markdown editor component (e.g., `@uiw/react-md-editor` or CodeMirror with markdown mode)
- File watcher for hot-reloading skill edits during development

---

### 9. Onboarding

First-run experience. Must be frictionless.

**Components:**
- **Welcome screen** â€” app intro, value prop
- **Codex auth flow:**
  - Trigger ChatGPT OAuth via app-server `account/login/start` with type `chatgpt`
  - Handle the device auth flow (Codex opens a browser for OAuth, app listens for completion)
  - Show success/failure state
  - Fallback: manual API key entry
- **Canvas setup wizard:**
  - Step 1: Select your institution (or enter Canvas URL manually) â€” stores the base URL
  - Step 2: Visual guide showing exactly where to find the personal access token in Canvas settings (screenshots/GIF)
  - Step 3: Paste token â†’ app validates by calling Canvas API `/api/v1/users/self`
  - Step 4: First sync â€” pull courses, show them to student for confirmation
- **Preference setup:**
  - When do you prefer to study? (morning / afternoon / evening)
  - How long can you study in one sitting? (30min / 1hr / 2hr / custom)
  - What days are off-limits? (multi-select)
  - Notification preferences (push on/off, quiet hours)
  - Writes to `preferences/prefs.md`
- **Routines input:**
  - Import from calendar (if calendar MCP is installed â€” deferred for v1)
  - Manual entry: recurring weekly blocks (class times, work shifts, commitments)
  - Writes to `routines/schedule.md`
- **Initial memory population:**
  - Canvas sync populates `courses/` directory
  - Preferences + routines write their respective files
  - Profile compiler runs to generate initial `profile.md`
  - First planner run generates the student's initial weekly plan
- **Walkthrough:**
  - Quick tour of dashboard, chat, and how to ask the assistant for help
  - Introduce the plan-mode skill with a live demo

**Depends on:** AI Harness (auth), Canvas MCP Server (validation + first sync), Memory System (initial writes), Planner (first plan generation)

**Depended on by:** Nothing â€” it's the entry point

**Tech needed:**
- React step-wizard component (or custom stepper)
- Electron `shell.openExternal` for OAuth browser redirect
- Screenshot/GIF assets for Canvas token guide (per-institution if possible, generic fallback)

---

## Implementation Phases

### Phase 0: Project Scaffold (Week 1)

**Goal:** Empty app that builds and runs.

| Task | Details |
|------|---------|
| Electron + Vite + React setup | Use electron-vite or similar boilerplate. Bun as runtime. |
| Effect-TS server scaffold | Basic HTTP + WebSocket server, starts with Electron |
| SQLite initialization | Database file creation, migration system (Effect-TS based) |
| Tray app setup | Electron tray icon, window show/hide, quit |
| Monorepo structure | `packages/electron`, `packages/server`, `packages/ui`, `packages/shared` (Effect Schema contracts) |
| Shared contracts | Effect Schema definitions for WebSocket messages between UI and server |

```
studentclaw/
â”œâ”€â”€ packages/
â”‚   â”œâ”€â”€ electron/          â† Electron main process
â”‚   â”œâ”€â”€ server/            â† Effect-TS local server
â”‚   â”‚   â”œâ”€â”€ services/      â† AI, Memory, Canvas, Planner, Notifications
â”‚   â”‚   â”œâ”€â”€ mcp-servers/   â† Canvas MCP server code
â”‚   â”‚   â””â”€â”€ db/            â† SQLite schema + migrations
â”‚   â”œâ”€â”€ ui/                â† React + Vite
â”‚   â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ pages/         â† Dashboard, Chat, Onboarding, Settings
â”‚   â”‚   â””â”€â”€ hooks/
â”‚   â”œâ”€â”€ shared/            â† Effect Schema contracts, types, constants
â”‚   â””â”€â”€ skills/            â† Bundled skill markdown files
â”œâ”€â”€ memory/                â† User memory directory (created at runtime)
â””â”€â”€ package.json
```

---

### Phase 1: AI Harness + Memory Foundation (Weeks 2-3)

**Goal:** You can chat with the AI and it remembers things.

**Week 2:**
- Codex app-server subprocess manager (spawn, healthcheck, restart)
- JSON-RPC client: initialize handshake, submit turns, stream responses
- ChatGPT OAuth flow (trigger login, handle completion, store auth state)
- Basic WebSocket bridge: user types in React â†’ server â†’ Codex â†’ stream back to React
- Test: can you have a conversation through the app?

**Week 3:**
- Memory file structure creation (all directories + template files)
- SQLite tables for vector index (`memory_chunks`: id, category, source_file, content, embedding)
- Embedding generation pipeline (chunk markdown â†’ call OpenAI embeddings â†’ store)
- Profile compiler (read all categories â†’ generate compact `profile.md`)
- System prompt builder (soul.md + profile.md â†’ system prompt on every turn)
- Memory retriever (given query, semantic search â†’ top-k chunks)
- Test: ask the AI about something stored in memory, verify it retrieves correctly

---

### Phase 2: Canvas + Core Intelligence (Weeks 4-5)

**Goal:** The app knows your classes and can plan your week.

**Week 4:**
- Canvas MCP server scaffold (MCP SDK, stdio transport)
- Canvas REST API client (courses, assignments, grades, syllabus)
- Token storage (encrypted via Electron safeStorage)
- Register Canvas MCP server with Codex app-server
- Canvas background sync service (polling, snapshot, diffing)
- Populate `courses/` memory directory from Canvas data
- Test: ask the AI "what's due this week?" and get real Canvas data

**Week 5:**
- Planner SQLite tables (`tasks`, `planned_sessions`)
- Task analyzer (importance scoring, time estimation via Codex)
- Task decomposer (multi-session splitting via Codex)
- Slot finder (read routines, find open blocks â€” deterministic)
- Schedule builder (place sessions into slots â€” deterministic with AI guidance)
- Plan-mode skill (markdown instructions for Codex)
- Test: say "plan my week" and get a concrete schedule

---

### Phase 3: Dashboard + Notifications (Weeks 6-7)

**Goal:** Visual command center with proactive nudges.

**Week 6:**
- Dashboard layout (weekly calendar view, deadline cards, grade overview)
- Planned sessions rendered on calendar (from Planner data)
- Completion check-in flow (Yes / No / Yes, but...)
- Completion handler logic (reschedule on No, partial-reschedule on Yes-but)
- Weekly progress tracking (sessions completed/skipped)
- Real-time WebSocket updates (Canvas sync â†’ dashboard refresh)

**Week 7:**
- Notification evaluator (which Canvas changes are worth alerting)
- Notification composer (templates for simple events, Codex for complex ones)
- Electron native notification delivery
- Quiet hours enforcement (from preferences)
- Plan reminder notifications (X minutes before a planned session)
- Notification queue in SQLite (handle offline/backlog)
- Event-driven rescheduling (Canvas change â†’ plan adjustment â†’ notification)

---

### Phase 4: Personality + Skills + Onboarding (Weeks 8-9)

**Goal:** The assistant feels personal, skills are usable, new users can set up.

**Week 8:**
- soul.md v1 (craft the base personality â€” this is a writing/design task)
- Daily distillation job (end-of-day Codex session: conversation log â†’ memory updates)
- Interaction style learning (distillation extracts communication patterns â†’ adaptive soul.md section)
- Profile regeneration after distillation
- Skills loader + activator (auto/keyword/manual trigger logic)
- Bundled skills authoring (plan-mode, study-helper, exam-prep, essay-helper, explain-like)
- Skill context budget integration with AI Harness

**Week 9:**
- Onboarding wizard UI (step-by-step flow)
- Codex auth step (ChatGPT OAuth)
- Canvas setup step (URL input, token guide, validation, first sync)
- Preferences setup step
- Routines input step
- Initial plan generation (planner runs after onboarding completes)
- Skill editor UI (markdown editor for custom skills)
- App walkthrough / first-run tour

---

### Phase 5: Integration Testing + Polish (Week 10)

**Goal:** Everything works together reliably.

| Task | Details |
|------|---------|
| End-to-end flow testing | New user â†’ onboarding â†’ first plan â†’ complete sessions â†’ distillation â†’ next day |
| Codex error handling | Rate limits, auth expiry, subprocess crashes, network failures |
| Canvas edge cases | Unpublished assignments, missing due dates, weird syllabus formats |
| Memory stress testing | Simulate a full semester of data, verify retrieval quality + context budget |
| Notification reliability | Verify notifications fire correctly, quiet hours work, queue drains |
| Performance | App startup time, Codex cold start, Canvas sync latency |
| Offline graceful degradation | What happens with no internet? Cached Canvas data + local memory should still work for basic chat |

---

## Dependency Graph (Build Order)

```
Phase 0          Phase 1              Phase 2              Phase 3           Phase 4
â”€â”€â”€â”€â”€â”€â”€â”€         â”€â”€â”€â”€â”€â”€â”€              â”€â”€â”€â”€â”€â”€â”€              â”€â”€â”€â”€â”€â”€â”€           â”€â”€â”€â”€â”€â”€â”€

Scaffold â”€â”€â–º  AI Harness â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º Canvas MCP â”€â”€â”€â”€â”€â”€â”€â”€â–º Notifications â”€â”€â–º Onboarding
    â”‚              â”‚                     â”‚                     â–²               â”‚
    â”‚              â–¼                     â–¼                     â”‚               â”‚
    â””â”€â”€â”€â”€â–º  Memory System â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º Planner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º Dashboard â—„â”€â”€â”€â”€ Soul/Personality
                   â”‚                     â–²                                     â”‚
                   â”‚                     â”‚                                     â”‚
                   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                               Skills System
                   (routines + courses                                        â”‚
                    feed into planner)                                         â”‚
                                                                              â–¼
                                                                        Skill Editor UI
```

**Critical path:** Scaffold â†’ AI Harness â†’ Memory System â†’ Canvas MCP â†’ Planner â†’ Dashboard

Everything else can be parallelized around this spine.

---

## SQLite Schema (Core Tables)

```sql
-- Memory vector index
CREATE TABLE memory_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,           -- 'long-term', 'courses', 'routines', 'preferences', 'daily'
    source_file TEXT NOT NULL,        -- relative path to markdown file
    heading TEXT,                     -- section heading within file
    content TEXT NOT NULL,            -- chunk text
    embedding BLOB,                   -- vector embedding (float32 array)
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Canvas sync snapshot
CREATE TABLE canvas_courses (
    id INTEGER PRIMARY KEY,
    canvas_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    term TEXT,
    synced_at DATETIME
);

CREATE TABLE canvas_assignments (
    id INTEGER PRIMARY KEY,
    canvas_id INTEGER UNIQUE NOT NULL,
    course_id INTEGER NOT NULL REFERENCES canvas_courses(id),
    name TEXT NOT NULL,
    description TEXT,
    due_at DATETIME,
    points_possible REAL,
    submission_status TEXT,           -- 'submitted', 'missing', 'not_yet', 'graded'
    score REAL,
    synced_at DATETIME
);

CREATE TABLE canvas_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,        -- 'assignment', 'grade', 'announcement'
    entity_id INTEGER,
    change_type TEXT NOT NULL,        -- 'added', 'updated', 'removed'
    old_value TEXT,                   -- JSON of previous state
    new_value TEXT,                   -- JSON of new state
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notified INTEGER DEFAULT 0       -- whether notification was sent
);

-- Planner
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    canvas_assignment_id INTEGER REFERENCES canvas_assignments(id),
    course_id INTEGER REFERENCES canvas_courses(id),
    title TEXT NOT NULL,
    importance_score REAL,            -- 0-1 computed score
    estimated_minutes INTEGER,
    needs_splitting INTEGER DEFAULT 0,
    deadline DATETIME,
    status TEXT DEFAULT 'pending',    -- 'pending', 'planned', 'completed', 'skipped'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE planned_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    session_label TEXT,               -- "Research phase", "Writing session 2/3"
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status TEXT DEFAULT 'scheduled',  -- 'scheduled', 'completed', 'skipped', 'partial'
    completion_note TEXT,             -- student's "yes, but..." note
    completed_at DATETIME
);

-- Notifications
CREATE TABLE notification_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,               -- 'deadline_reminder', 'grade_posted', 'plan_change', 'insight'
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    priority TEXT DEFAULT 'normal',   -- 'low', 'normal', 'high'
    scheduled_for DATETIME,
    delivered INTEGER DEFAULT 0,
    delivered_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL                -- JSON encoded
);
```

---

## Key Technical Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI backbone | Codex app-server (subprocess) | ChatGPT subscription auth, native MCP support, OpenAI challenge alignment |
| AI model | GPT-5.4 (not Codex-tuned) | General-purpose reasoning > code optimization for student assistant |
| Runtime | Bun | Fast startup, native SQLite, TS-first |
| Backend framework | Effect-TS | Structured concurrency, typed errors, composable services |
| Database | SQLite | Local-first, single file, no server dependency |
| Vector search | sqlite-vec extension | Keeps everything in one DB, no additional service |
| Embeddings | OpenAI text-embedding-3-small | Quality + student already has auth. ~$0.02/1M tokens. |
| MCP SDK | @modelcontextprotocol/sdk | Official TypeScript SDK, stable |
| Memory format | Markdown files + SQLite vector index | Human-readable, AI-friendly, transparent to student |
| Planner strategy | Hybrid (AI reasoning + deterministic scheduling) | AI estimates and decomposes; code enforces constraints |
| Skills format | Markdown with YAML frontmatter | Simple, authorable, shareable |
| Token encryption | Electron safeStorage | OS-level encryption (Keychain on macOS, etc.) |
| Background sync | Effect-TS Schedule (not Codex) | Lightweight, no AI cost for polling |
| Notifications | Electron Notification API | Native OS integration, works in tray mode |