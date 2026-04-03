# Feature 9: Smart Planner

## What It Is

The Smart Planner is the flagship intelligence feature. It takes Canvas assignment data, the student's routines and preferences from memory, and produces a concrete, actionable study plan. It's a hybrid system: the AI reasons about what tasks to prioritize and how to decompose them, while deterministic code handles constraint-checking, slot-finding, and calendar placement.

---

## Why It Exists

Students know they have assignments due. What they struggle with is *when* to work on them, *how long* it'll take, and *how to split up* large tasks across multiple days. The Smart Planner answers all three and produces a schedule the student can follow — then adapts when life happens.

---

## Dependencies

```
AI Harness ──────→ Smart Planner (Codex does reasoning for analysis, decomposition, rescheduling)
Memory System ───→ Smart Planner (routines, preferences, past time estimates)
Canvas Integration → Smart Planner (assignment data, deadlines, grade weights)
```

| Depends On | Why |
|---|---|
| **AI Harness** | Codex handles task analysis, time estimation, decomposition, and natural-language rescheduling |
| **Memory System** | Routines (`agent_id="routines"`), preferences (`agent_id="preferences"`), behavioral patterns (`agent_id="behavioral"`) |
| **Canvas Integration** | Assignment data, deadlines, grade weights from Canvas sync |

| Depended On By | Why |
|---|---|
| **Dashboard** | Weekly calendar view shows planned sessions; completion check-ins read session status |
| **Notification Service** | Plan reminders before scheduled sessions; reschedule alerts |
| **Skill System** | The `plan-mode.md` skill instructs the AI how to invoke planner services |

---

## Planning UX — Streaming and Cancellation

Plan generation is **streamed progressively**, not blocking. At 15–30 seconds of total planning time, blocking is not viable — students will assume the app is frozen.

- The `PlannerService` emits status events through the AI Harness's existing streaming channel as each stage completes.
- Internal events are mapped to **student-friendly messages** before surfacing (e.g., "Looking at your Problem Set 3...", "Checking your schedule for open time..."). Events without a clean mapping are silently skipped — raw implementation details are never exposed.
- The calendar view assembles incrementally as sessions are placed; students see progress in real time.
- A **cancel/abort** mechanism is required — students need to stop and restart if they realize their input (routines, preferences) was wrong mid-plan.

---

## Plan Generation Triggers

| Trigger | When | Notes |
|---|---|---|
| **Auto — first plan** | Immediately after onboarding completes (Canvas connected + routines set) | Surfaces as "Here's your first plan — want to adjust anything?" Creates the first-use moment. |
| **Student-initiated** | "Plan my week" chat request or Dashboard button | All replanning after the first plan. |
| **Event-driven** | Canvas change event (deadline moved, new assignment) | Handled by the Reschedule Engine, not a full replan. |

---

## Core Responsibilities

### 1. Task Analyzer

Takes an assignment from Canvas and determines its planning parameters using a **three-layer priority model** (not a weighted linear score):

**Layer 1 — Urgency Gate (hard interrupt, computed deterministically)**

```
hours_remaining = due_at - now

if hours_remaining < estimated_effort_hours * 1.5  →  RED   (may not finish in time)
if hours_remaining < 48                             →  YELLOW (do soon)
else                                                →  GREEN  (plan, don't panic)
```

The RED threshold is dynamic — it depends on AI-estimated effort, so a 30-min quiz doesn't go RED until hours before, but a 20-page paper goes RED days out. Within RED, sort by earliest deadline (triage mode). Within YELLOW and GREEN, sort by Layer 2.

**Layer 2 — Impact Score (primary ranking within each zone)**

```
grade_impact    = (points_possible / total_group_points) × assignment_group_weight
course_priority = student's drag-and-drop course ranking, normalized 0–1 via linear spacing (position / (N-1))

impact = grade_impact × course_priority   ← multiplicative, not additive
```

`grade_impact` is exact from Canvas API (`assignment.points_possible`, `assignment_group.group_weight`). `course_priority` is set via drag-and-drop ranking during onboarding (linear normalization: `position / (N-1)`). It can also be **updated conversationally** — if the student mentions a course is more/less important, the AI updates the ranking from the conversation without requiring a manual re-sort. When a new course is added mid-semester, a **re-rank prompt** fires immediately so the course is placed correctly from the start. Multiplicative ensures a low-priority course can't elevate its assignments above a high-priority one regardless of grade weight.

**Layer 3 — Effort Tiebreaker (AI-estimated, bounded influence)**

When two tasks have impact scores within ±0.05 epsilon, shorter estimated task goes first (WSJF logic). AI estimates effort from: assignment name, description, `submission_type`, `points_possible`, course subject, and syllabus context. Returns `{ estimated_minutes, confidence }`. When confidence is low, widen epsilon — a shaky estimate shouldn't reorder materially different tasks.

**Effort estimation precedence:**
1. **Historical personal data** (≥3 data points for that assignment type in that course) — most accurate, used directly
2. **AI estimation** when history is sparse — uses assignment metadata as primary input, with available personal history (even 1-2 points) as soft context to narrow the range
3. **Default table** (below) — last resort when no Canvas metadata, no history, and no course context exists

All estimates return `{ estimated_minutes, confidence }`. Low confidence widens the Layer 3 epsilon and surfaces "estimated (uncertain)" in the UI.

**AI effort estimation inputs (for cases 1 and 2):**
- `assignment.name`, `assignment.description`, `assignment.submission_types` — from Canvas
- `assignment.points_possible`, `assignment_group.group_weight` — from Canvas
- Course subject and syllabus context — from course memory
- Student's historical time data — from behavioral memory (used as context even when sparse)

- **Splitting detection**: Assignments estimated at >2 hours are flagged for multi-session splitting
- **Dependency detection**: Identifies prerequisites ("need to read Ch.5 before starting this problem set") using assignment descriptions and course memory
  - **Enforcement**: Detected dependencies are hard-enforced — the dependent session won't be scheduled before the prerequisite ends. Bypass is available with minimal friction (one tap: "I already did this").
  - **Confidence threshold**: Low-confidence dependencies (AI unsure) are silently dropped. Only high-confidence detections are enforced, avoiding false constraints on the student's schedule.

**Default time estimates** (used when no historical data exists):

| Assignment Type | Estimate |
|---|---|
| Reading response | 1-2 hours |
| Problem set | 2-4 hours |
| Short essay | 3-5 hours |
| Long essay / research paper | 8-15 hours |
| Exam studying | 4-8 hours |

### 2. Task Decomposer

Breaks large tasks into manageable sub-sessions. This is AI-driven — Codex determines the logical breakdown using course memory to understand what's actually involved.

**Decomposition patterns:**
- **Exam studying** → Spaced review sessions across multiple days
- **Research paper** → Outline session, research session(s), writing session(s), review session
- **Large problem set** → Split into logical groups of problems per session
- **Group project** → Individual prep sessions, collaboration blocks

**Approval and adaptation:**
- **First time** a given assignment type is decomposed, the breakdown is shown to the student for approval before scheduling. They can merge, split, or rename sessions.
- **Subsequent times**, the decomposition runs automatically (no upfront prompt) but adapts using two factors:
  1. **Behavioral history** — how the student actually completed past sessions of that type (e.g., consistently finishing "outline sessions" in 30 min instead of 60 → shrink that step)
  2. **Explicit settings** — preferences and any adjustments the student made during prior approvals
- The resulting breakdown is always editable after the fact, so the student retains control even without an upfront approval step.

### 3. Slot Finder

Queries the student's routines and preferences to find available time blocks. This is **deterministic** — no AI involved.

- Read routines from memory (`agent_id="routines"`): class times, work shifts, recurring commitments
- Read preferences from memory (`agent_id="preferences"`): quiet hours, break requirements, max study duration, preferred study times
- Compute available slots using a **rolling 6-week tiered window**:
  - **Active window (weeks 1–2)**: Concrete time blocks with exact start/end times
  - **Placeholder window (weeks 3–6)**: Reserved day-level blocks without exact times; concretized when they roll into the active window
- This ensures long projects (research papers, multi-week exams) get protected time early without over-committing to a schedule that will shift
- Respect hard constraints: no double-booking, no scheduling during class, no scheduling during quiet hours
- **Snap grid**: 15-minute intervals (sessions start at :00, :15, :30, :45 only)
- **Minimum session length**: 30 minutes — tasks estimated under 30 minutes are rounded up
- **Recommended session cap**: 3 hours. The planner won't schedule beyond this by default. If a student tries to set a max duration above 3 hours, they're shown a warning explaining diminishing returns — but after **2 confirmations** they can override and set whatever they want (e.g., 6-hour cram sessions before an exam).
- **Auto-break insertion**: Any session ≥90 minutes is automatically split with a break (e.g., two 80-min blocks with a 20-min gap). Breaks appear in the calendar as breathing room, not as tasks. Student can disable this in preferences.

### 4. Schedule Builder

Places task sessions into available slots. **Deterministic with AI guidance** — the algorithm enforces constraints, but the three-layer priority model drives ordering.

- **Work backward from deadlines**: Place sessions early enough to finish before due dates
- **Priority order**: RED zone tasks first (sorted by deadline), then YELLOW, then GREEN (both sorted by impact score × course_priority); effort tiebreaker within ±0.05 epsilon
- **Distribute cognitive load**: A day is considered overloaded when the sum of `impact_score` values across all sessions that day exceeds **2.0**. When adding a session would breach this threshold, it's bumped to the next available day. Uses the existing impact score — no additional AI judgment in the Schedule Builder.
- **Leave buffer time**: Never schedule the final session for the day a task is due
- **Respect productivity patterns**: If the student prefers mornings, schedule harder tasks earlier in the day

### 5. Reschedule Engine

Handles two types of plan changes:

**Student-initiated**: The student says "can't do this tonight" or "move this to tomorrow."
- Find alternative slots within the same deadline window
- **Ripple scope**: Ripple adjusts only the remaining sessions of the **same task** (e.g., session 2/3 moves → session 3/3 adjusts). Cross-task ripple is avoided to prevent the whole week from shifting on a single skip.
- **Exception**: If a task is in RED zone and has no valid slots after ripple, run a targeted mini-replan for that task only — not a full reschedule.
- AI generates a natural-language explanation of what changed and why

**Event-driven**: A Canvas change event arrives (e.g., deadline moved, new assignment posted).
- Evaluate the impact on the current plan
- Determine if rescheduling is needed
- If yes: adjust the plan automatically and trigger a notification via the [Notification Service](10-notification-service.md)

**Canvas assignment removed/unpublished**:
- Soft-delete the task (`status = 'cancelled'`) — never hard-delete; historical session data is retained for estimation accuracy
- Mark all future `planned_sessions` for that task as `cancelled`
- **Free up the slots**: feed the now-available time blocks back into the Schedule Builder and fill them with the next highest-priority pending tasks
- Notify the student: "Assignment [X] was removed from Canvas. Sessions cancelled — I've rescheduled other work into that time."

### 6. Completion Handler

**Check-in trigger:** Hybrid — the student can check in manually at any time via the Dashboard, but two `SessionCheckIn` events are emitted to the [Notification Service](10-notification-service.md) if they haven't:
1. **+9 minutes** after scheduled session end
2. **+30 minutes** after scheduled session end

Both events are silenced (no further notifications) as soon as the student checks in. No further prompts after 30 minutes — if neither is acted on, the session enters an **unresolved** state.

**Unresolved session rules:**
- Unresolved sessions are capped at **3 at a time**. When a 4th unresolved session would be created, the oldest unresolved is automatically promoted to `skipped` and fed into the reschedule engine (FIFO eviction).
- Students are **prompted at login** with any unresolved sessions so they can respond (Yes / No / Yes, but...) before seeing their plan.
- An auto-skipped session can be manually corrected from session history at any time.

Processes the three completion states from the [Dashboard](06-dashboard.md)'s check-in prompt:

| Response | Action |
|---|---|
| **Yes** | Mark session as `completed`. Write two memory records: (1) `agent_id="behavioral"` — `{ assignment_type, course_id, estimated_minutes, actual_minutes, completed_at }` where `actual_minutes = completed_at − scheduled_start_time` (derived, no timer required) for future effort estimation; (2) `agent_id="progress"` — update completion streak and weekly stats for the reflection view. If this was the last session for a task, mark the task as `completed`. |
| **No** | Mark session as `skipped`. Reschedule the session to the next available slot. Adjust downstream sessions. |
| **Yes, but...** | Capture the student's note (e.g., "finished reading but not the analysis"). Mark as `partial`. Create a follow-up session for the remaining work. Feed the note into memory for future estimation accuracy. Follow-up session sizing and placement rules below. |

**"Yes, but..." follow-up session rules:**

- **Sizing**: AI re-estimates duration from the student's note and returns `{ estimated_minutes, confidence }`. Fallback when confidence is low: **half the original session's estimated time, rounded to the nearest 15-minute interval** (e.g., a 90-min session → 45 min follow-up).
- **Placement**: Scheduled greedily into the next available slot — bypasses the normal priority queue since it's in-progress work. Exception: if the task's deadline falls before the earliest available slot, the ripple/reschedule engine fires to find capacity or escalate to the student.

---

## Data Model (SQLite)

### `tasks` table

```
tasks
  id              INTEGER PRIMARY KEY AUTOINCREMENT
  course_work_item_id  INTEGER REFERENCES coursework_items(id)
  course_id       INTEGER REFERENCES courses(id)
  title           TEXT NOT NULL
  urgency_zone      TEXT             -- 'red', 'yellow', 'green' (Layer 1 gate)
  impact_score      REAL             -- grade_impact × course_priority (Layer 2)
  effort_confidence REAL             -- AI confidence in estimated_minutes (Layer 3 epsilon input)
  estimated_minutes INTEGER
  needs_splitting INTEGER DEFAULT 0
  deadline        DATETIME
  status          TEXT DEFAULT 'pending'  -- 'pending', 'planned', 'completed', 'skipped', 'cancelled'
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
```

### `planned_sessions` table

```
planned_sessions
  id              INTEGER PRIMARY KEY AUTOINCREMENT
  task_id         INTEGER NOT NULL REFERENCES tasks(id)
  session_label   TEXT               -- "Research phase", "Writing session 2/3"
  start_time      DATETIME NOT NULL
  end_time        DATETIME NOT NULL
  status          TEXT DEFAULT 'scheduled'  -- 'scheduled', 'completed', 'skipped', 'partial', 'unresolved', 'cancelled'
  completion_note TEXT               -- student's "yes, but..." note
  completed_at    DATETIME
```

### `user_preferences` table

```
user_preferences
  id                    INTEGER PRIMARY KEY AUTOINCREMENT
  max_study_minutes     INTEGER DEFAULT 180        -- 3hr default; student can override after 2 confirmations
  auto_break_enabled    INTEGER DEFAULT 1          -- break insertion for sessions ≥90 min
  break_duration_minutes INTEGER DEFAULT 20
  preferred_study_times TEXT                       -- JSON array of preferred time-of-day windows
  course_priority_order TEXT                       -- JSON array of course_ids in ranked order
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
```

Hard planning constraints (session caps, break rules, course priority order) live here — not in the memory agent. The memory agent holds behavioral patterns and soft context; this table holds queryable, deterministic inputs to the Slot Finder and Schedule Builder.

Conversational updates to course priority (e.g., student says "that class is more important to me") are written back here via a `preferences.updateCoursePriority` tool call emitted by the AI — same tool call routing pattern as all other AI-initiated writes.

---

## Key Design Decision: Hybrid AI + Deterministic

The planner walks a line between AI reasoning and deterministic logic.

| Concern | Who Handles It | Why |
|---|---|---|
| Task analysis | **AI** (Codex) | Requires understanding assignment descriptions, course context, student history |
| Time estimation | **AI** (Codex) | Varies by student, assignment type, and complexity |
| Task decomposition | **AI** (Codex) | Logical breakdown requires understanding what the work involves |
| Slot finding | **Deterministic code** | Pure constraint satisfaction — no judgment needed |
| Constraint checking | **Deterministic code** | No double-booking, deadline validation — must be correct, not creative |
| Calendar placement | **Deterministic code** | Algorithm with clear rules (priority ordering, load balancing) |
| Rescheduling explanations | **AI** (Codex) | Natural-language explanation of why the plan changed |
| Completion state transitions (Yes / No) | **Deterministic code** | Pure status updates, memory writes, streak increments — no judgment needed |
| Follow-up effort estimation ("Yes, but...") | **AI** (Codex) | Reads the student's note and estimates how long the remaining work will take |

This hybrid approach prevents the AI from hallucinating impossible schedules (scheduling during class, double-booking, ignoring deadlines) while leveraging its strength in understanding context and generating human-friendly output.

---

## Proposed File Structure

```
packages/server/src/planner/
  PlannerService.ts         # Effect service: orchestrates the full planning pipeline
  TaskAnalyzer.ts           # Importance scoring, time estimation (calls Codex)
  TaskDecomposer.ts         # Multi-session splitting (calls Codex)
  SlotFinder.ts             # Available time block computation (deterministic)
  ScheduleBuilder.ts        # Session placement algorithm (deterministic)
  RescheduleEngine.ts       # Student-initiated + event-driven rescheduling; two entry points: rescheduleForStudent(sessionId, reason) and rescheduleForEvent(canvasEvent); shared ripple/slot core
  CompletionHandler.ts      # Yes/No/Yes-but processing and memory updates
```

---

## Open Questions

- ~~**Calendar integration**~~ ✅ **Resolved**: External calendar sync (Apple Calendar, Google Calendar) is **offered but not mandatory**. If the student has connected a calendar via MCP, planned sessions are written to it automatically. If not, sessions appear in the Dashboard only. No MCP connection = no calendar sync; no degraded functionality.
- ~~**Conflict resolution**~~ ✅ **Resolved**: Two-step escalation when no slots are available:
  1. **Auto-compress** (sparingly): Attempt to shorten/merge buffered sessions — but only if the AI is ≥95% confident the work fits in the compressed time. If confidence is below that threshold, skip entirely.
  2. **Escalate to student**: Surface a conflict notification — "No slot found for [Assignment]. Can you free up time on [Day A] or [Day B]?" — and re-run after the student responds. Never auto-drop tasks.
- ~~**Multi-week planning**~~ ✅ **Resolved**: Rolling 6-week tiered window — active (weeks 1–2) with concrete blocks, placeholder (weeks 3–6) with day-level reservations that concretize when they enter the active window.
- ~~**Collaborative planning**~~ 🚫 **Out of scope.** Not planned; no stubs or data model hooks.
- ~~**Plan history**~~ ✅ **Resolved**: All `planned_sessions` rows are kept permanently — never deleted. History serves two purposes:
  1. **Backend**: Powers behavioral memory and estimation accuracy over time.
  2. **Student-facing**: A visible reflection view in the Dashboard showing completion stats, streaks, and totals (e.g., "Last month: 40h planned, 32h completed. 🔥 12-day streak"). Streak visibility is intentional — seeing an active streak increases the likelihood students don't break it.
