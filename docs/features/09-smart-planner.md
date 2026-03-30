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

## Core Responsibilities

### 1. Task Analyzer

Takes an assignment from Canvas and determines its planning parameters.

- **Importance score** (0-1): Computed from grade weight in syllabus, percentage of final grade, proximity to deadline
- **Estimated time**: Based on assignment type + historical data from memory (if the student usually takes 4 hours for problem sets, use that). Falls back to defaults if no history exists.
- **Splitting detection**: Assignments estimated at >2 hours are flagged for multi-session splitting
- **Dependency detection**: Identifies prerequisites ("need to read Ch.5 before starting this problem set") using assignment descriptions and course memory

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

### 3. Slot Finder

Queries the student's routines and preferences to find available time blocks. This is **deterministic** — no AI involved.

- Read routines from memory (`agent_id="routines"`): class times, work shifts, recurring commitments
- Read preferences from memory (`agent_id="preferences"`): quiet hours, break requirements, max study duration, preferred study times
- Compute available slots for each day in the planning window (next 14 days)
- Respect hard constraints: no double-booking, no scheduling during class, no scheduling during quiet hours

### 4. Schedule Builder

Places task sessions into available slots. **Deterministic with AI guidance** — the algorithm enforces constraints, but the AI's importance scores and time estimates drive the ordering.

- **Work backward from deadlines**: Place sessions early enough to finish before due dates
- **Prioritize by importance score**: Higher-scoring tasks get scheduled first and into better slots
- **Distribute cognitive load**: Don't stack 3 hard tasks on the same day; alternate heavy and light work
- **Leave buffer time**: Never schedule the final session for the day a task is due
- **Respect productivity patterns**: If the student prefers mornings, schedule harder tasks earlier in the day

### 5. Reschedule Engine

Handles two types of plan changes:

**Student-initiated**: The student says "can't do this tonight" or "move this to tomorrow."
- Find alternative slots within the same deadline window
- Ripple-adjust downstream tasks if needed
- AI generates a natural-language explanation of what changed and why

**Event-driven**: A Canvas change event arrives (e.g., deadline moved, new assignment posted).
- Evaluate the impact on the current plan
- Determine if rescheduling is needed
- If yes: adjust the plan automatically and trigger a notification via the [Notification Service](10-notification-service.md)

### 6. Completion Handler

Processes the three completion states from the [Dashboard](06-dashboard.md)'s check-in prompt:

| Response | Action |
|---|---|
| **Yes** | Mark session as `completed`. Update daily memory. Increment progress tracking. If this was the last session for a task, mark the task as `completed`. |
| **No** | Mark session as `skipped`. Reschedule the session to the next available slot. Adjust downstream sessions. |
| **Yes, but...** | Capture the student's note (e.g., "finished reading but not the analysis"). Mark as `partial`. Create a follow-up session for the remaining work. Feed the note into memory for future estimation accuracy. |

---

## Data Model (SQLite)

### `tasks` table

```
tasks
  id              INTEGER PRIMARY KEY AUTOINCREMENT
  canvas_assignment_id  INTEGER REFERENCES canvas_assignments(id)
  course_id       INTEGER REFERENCES canvas_courses(id)
  title           TEXT NOT NULL
  importance_score  REAL             -- 0-1 computed score
  estimated_minutes INTEGER
  needs_splitting INTEGER DEFAULT 0
  deadline        DATETIME
  status          TEXT DEFAULT 'pending'  -- 'pending', 'planned', 'completed', 'skipped'
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
  status          TEXT DEFAULT 'scheduled'  -- 'scheduled', 'completed', 'skipped', 'partial'
  completion_note TEXT               -- student's "yes, but..." note
  completed_at    DATETIME
```

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
  RescheduleEngine.ts       # Student-initiated + event-driven rescheduling
  CompletionHandler.ts      # Yes/No/Yes-but processing and memory updates
```

---

## Open Questions

- **Calendar integration**: Should planned sessions also be written to an external calendar (Apple Calendar, Google Calendar) via MCP, or only shown in the Dashboard?
- **Conflict resolution**: When a Canvas event requires rescheduling but no slots are available, what happens? Notify the student and ask for guidance?
- **Multi-week planning**: Should the planner look beyond 14 days for long-term projects like research papers?
- **Collaborative planning**: If multiple students in a study group use Student Claw, could their plans coordinate? (Future feature)
- **Plan history**: Should we keep past plans for reflection? "Last month you planned 40 hours of study and completed 32."
