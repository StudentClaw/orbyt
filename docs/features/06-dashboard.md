# Feature 6: Dashboard

## What It Is

The Dashboard is the student's home screen — the first thing they see when they open Student Claw. It aggregates data from Canvas, the Memory System, and the AI's planning output into a visual overview of their academic life: what's due, how they're doing, and what they should work on next.

---

## Why It Exists

Students lose track of things. Assignments are spread across Canvas pages, email reminders, syllabi, and group chats. The Dashboard consolidates everything into a single view that answers the three questions every student has:

1. **What's due soon?** — Deadline countdowns and upcoming assignments
2. **How am I doing?** — Grade tracking and trend analysis
3. **What should I do next?** — AI-suggested priorities based on deadlines, difficulty, and past behavior

---

## Dependencies

```
Canvas Integration ──→ Dashboard (grades, assignments, announcements)
Memory System ──────→ Dashboard (study patterns, time estimates, preferences)
WebSocket Server ───→ Dashboard (real-time updates from background sync)
Shared Contracts ───→ Dashboard (Course, Assignment, Grade, StudyPlan schemas)
```

| Depends On | Why |
|---|---|
| **Canvas Integration** | All academic data (assignments, grades, announcements) comes from Canvas |
| **Smart Planner** | Scheduled study sessions, completion tracking data |
| **Memory System** | Study patterns, time estimates, behavioral data for insights |
| **Notification Service** | Proactive insight cards surfaced on the dashboard |
| **WebSocket Server** | Real-time push updates when background sync finds changes |
| **Shared Contracts** | `Course`, `Assignment`, `Grade`, `StudyPlan` schemas |

| Depended On By | Why |
|---|---|
| **Onboarding** | First-sync walkthrough populates and explains the Dashboard |
| **Plan-Mode** | Plan output is displayed in the Dashboard's calendar/priority views |
| **Chat UI** | Quick actions from Dashboard can open a chat with pre-filled context |

---

## Dashboard Sections

### 1. Priority Queue

The most important section. Shows what the student should work on right now, ranked by a priority score.

**Score recalculation triggers:**
- Canvas sync completes (new assignments or grades)
- Completion check-in submitted (progress changed)
- Nightly scheduled recalc (catches deadline drift)
- UI re-renders **only if the top-5 ranking changes** — silent recalcs don't reshuffle the list while a student is actively viewing it

**Priority score factors:**
- **Deadline proximity**: Closer = higher priority
- **Estimated effort**: Larger tasks need earlier starts
- **Grade weight**: A final paper worth 30% ranks above a 2% participation post
- **Student history**: Procrastination multiplier pulled from Memory System — tracks how many times each assignment type was skipped or started late. Higher skip/late count = effective deadline moved earlier in the score. Shape: `{ type: "essay", times_skipped: 3, times_started_late: 5 }`
- **Current progress**: Started but incomplete work gets a boost

**Display:**
- Card-based layout, top 5-7 items
- Each card shows: assignment title, course, due date (with countdown), estimated hours, progress indicator
- **Estimated hours**: Sourced directly from the [Smart Planner](09-smart-planner.md), which is the single source of truth for time estimates. The Dashboard displays whatever the planner produces — no separate defaults.
- **Large assignments** (estimated >3hrs) are automatically split into multiple study sessions by the Smart Planner. The Priority Card shows total estimated hours; individual sessions appear in the Weekly Calendar.
- Color-coded urgency: calm (7+ days), attention (3-6 days), urgent (1-2 days), overdue (red)

### 2. Grade Overview

Per-course grade tracking with trend analysis.

- **Current grades**: Letter grade + percentage per course
- **Trend arrows**: Improving, stable, or declining based on **weighted grade movement** over last 3-4 graded items (assignments with weight < 2% ignored). Thresholds: up (>+1%), stable (±1%), down (<-1%)
- **Grade chart**: Line chart showing grade trajectory over the semester
- **GPA projection**: Estimated semester GPA based on current grades, remaining work weight, and credit hours. Credit hours sourced from Canvas if available; otherwise entered manually by student during onboarding and stored in SQLite. Falls back to unweighted average with a visible disclaimer if credit hours are unavailable.

### 3. Upcoming Deadlines

A timeline/calendar strip view of the next 14 days.

- Visual timeline with assignments placed by due date
- Stacked bars for days with multiple deadlines — capped at 3 visible per day, with a "+N more" chip that expands to a popover showing full details
- Click to expand and see assignment details
- Integrates with plan-mode: if a study plan exists, show scheduled study blocks alongside deadlines

### 4. Weekly Progress

How much the student accomplished this week vs. planned.

- **Assignments completed**: Count with progress bar toward weekly goal
- **Study time logged**: Hours spent vs. planned (from plan-mode or manual tracking)
- **Streak**: Consecutive days with at least one completed study session (check-in marked "Yes" or "Yes, but..."). Opening the app alone doesn't count. Days with no sessions scheduled are skipped and don't break the streak. Missing a scheduled day resets to 0.
- **Comparison**: This week vs. last week

### 5. Announcements Feed

Recent announcements from all courses, sorted by date.

- Professor name, course, timestamp
- Truncated body with expand-to-read
- **Attachments**: Download only for v1 — show attachment chip, clicking downloads the file. ⚠️ Resolve before building: decide between download-only vs. open-in-default-app via `shell.openPath`.
- Mark as read/unread
- AI summary option: "Summarize this announcement" triggers a cloud API call via the **OpenAI Codex CLI bridge**. Summary cached in SQLite — re-opening the same announcement does not re-call the API.

### 6. Weekly Calendar View

A visual calendar showing planned study sessions from the [Smart Planner](09-smart-planner.md).

- Shows the current week with study sessions as colored blocks
- Color-coded by course (consistent colors across the app)
- Tap a session to see details: assignment name, estimated duration, session label ("Research phase", "Writing session 2/3")
- **Conflicts**: Overlapping sessions render as side-by-side split columns with a red border and "Schedule conflict" warning chip. Resolving opens the Smart Planner, which asks which session is higher priority and reschedules the conflicting one(s) to the next available slot.
- Tap to trigger rescheduling ("Can't do this tonight" → Smart Planner finds alternative slots)
- Deadline markers overlaid on the calendar for context

### 7. Completion Check-ins

At the scheduled end of a study session (or when the student opens the app), show a three-way completion prompt:

| Response | What Happens |
|---|---|
| **Yes** | Mark session done, update daily memory, increment progress tracking |
| **No** | Reschedule the session, adjust downstream sessions in the plan |
| **Yes, but...** | Capture the student's note (e.g., "finished reading but didn't start writing"), partial reschedule, feed note into memory for future planning accuracy |

**Delivery mechanism:**
- The Smart Planner emits `SessionCheckIn` events to the [Notification Service](10-notification-service.md) at +9 min and +30 min after session end. The Notification Service handles OS delivery. Both are silenced as soon as the student checks in. No further prompts after 30 minutes — unacted sessions enter an unresolved state.
- On notification click or next app open, the check-in prompt appears
- Unresolved check-ins are capped at 3. When a 4th would be created, the oldest is auto-promoted to `skipped` (FIFO eviction) and fed into the reschedule engine. Students are prompted at login with any unresolved sessions before seeing their plan.

Check-ins are non-blocking — dismissed if the student navigates away.

### 8. Proactive Insight Cards

AI-generated insight cards surfaced by the [Notification Service](10-notification-service.md) when relevant.

- "You have 3 deadlines next week — want to start planning?"
- "Your grades in CS 301 have been trending up — nice work."
- "You've been skipping Sunday study sessions — want to reschedule those?"

Cards are generated on two triggers:
- **Weekly (Sunday evening)**: Reflective insights — grade trends, study streak summaries, week-ahead planning prompts
- **Event-driven**: Urgent insights triggered immediately when: 3+ deadlines cluster within 7 days, a grade drops significantly (letter grade drops by a full letter OR scored 10+ percentage points below the student's course average), or a study plan has fallen behind

Cards appear as a horizontal scrollable strip at the top of the Dashboard (below Priority Queue). Generated by an AI call with the week's Canvas + Memory data as context.

### 9. Quick Actions

One-click actions that open the Chat with pre-filled context.

- "Plan my week" → Opens chat with plan-mode activated
- "Help with [assignment name]" → Opens chat with assignment context loaded
- "What's most important right now?" → Opens chat with priority context

**Interaction model**: Chat opens as a **slide-over panel from the right** — overlays the Dashboard without navigating away. Student can see Priority Queue while chatting. Closing the panel restores the full Dashboard view. No new Electron window.

---

## Data Flow

### Initial load
```
App opens
  → Renderer sends IPC request to main process
  → Main process reads cached data from SQLite (instant)
  → Renders with cached data
  → Main process triggers Canvas background sync
  → New data arrives via IPC push (ipcMain → ipcRenderer)
  → Dashboard updates incrementally (no full reload)
```

### Offline / staleness handling
```
Dashboard always renders from SQLite cache — never blocks on Canvas
  → If last sync < 1 day ago: no indicator
  → If last sync 1–2 days ago: warning banner ("Data may be outdated")
  → Canvas sync resumes automatically when connection restores
```

### Real-time updates
```
Canvas sync detects new grade (main process)
  → Main process pushes `grade.updated` event via IPC
  → Dashboard's grade chart animates the update
  → Notification badge appears if the app was in background
```

---

## Platform

Student Claw is a **desktop-first application**. The Dashboard is designed for a desktop environment (target: 1280px+ screen width).

- **Primary platform**: Desktop app built with **Electron**
- **Interaction model**: Mouse/keyboard — do not assume touch or hover-only interactions; avoid hover-dependent UI patterns that won't translate
- **Mobile companion**: Out of scope for v1, but a lightweight phone component may exist for **push notifications only** (deadline reminders, grade updates). The Dashboard itself will not be replicated on mobile in v1.
- **Responsive degradation**: Components should be responsive enough to not break at smaller window sizes, but the Dashboard is not optimized for mobile viewports

---

## Visual Design Direction

The Dashboard should feel like a focused command center, not an overwhelming data dump.

**Design principles:**
- **Hierarchy**: Priority Queue is dominant, grades and timeline are supporting
- **Calm by default**: Muted colors and clean layout when things are on track
- **Urgency when needed**: Color shifts and visual emphasis for approaching deadlines
- **Glanceable**: A student should understand their situation in 3 seconds
- **Dense but not cluttered**: Information-rich without feeling overwhelming

**Component library**: Uses shared UI components from the app's design system. Charts via a lightweight library (Recharts or Chart.js equivalent for React).

---

## Technology

| Library / Service | Purpose |
|---|---|
| `recharts` | Lightweight React charting for grade trajectories and progress visualization |
| Electron IPC | Main ↔ renderer communication for data and real-time updates |
| Effect Schema | Typed IPC event contracts shared between main and renderer |
| OpenAI Codex CLI bridge | Cloud AI calls for announcement summaries and insight card generation |
| Electron `safeStorage` | Secure local storage for API credentials |

---

## Proposed File Structure

```
packages/ui/src/components/dashboard/
  DashboardLayout.tsx           # Overall layout and section arrangement
  PriorityQueue.tsx             # Ranked assignment cards
  PriorityCard.tsx              # Individual assignment card
  GradeOverview.tsx             # Per-course grade summary
  GradeChart.tsx                # Grade trajectory line chart
  GpaProjection.tsx             # Semester GPA estimate
  DeadlineTimeline.tsx          # 14-day visual timeline
  WeeklyCalendar.tsx            # Study session calendar from Smart Planner
  CompletionCheckin.tsx         # Yes / No / Yes-but three-way prompt
  WeeklyProgress.tsx            # Completion stats and streaks
  InsightCards.tsx              # Proactive AI insight card strip
  AnnouncementsFeed.tsx         # Course announcements list
  AnnouncementCard.tsx          # Individual announcement
  QuickActions.tsx              # One-click chat launchers

packages/main/src/dashboard/
  DashboardService.ts           # Effect service: aggregate data for dashboard (main process)
  PriorityScorer.ts             # Calculate priority scores for assignments (main process)
  GradeAnalyzer.ts              # Trend analysis, GPA projection (main process)
  ProgressTracker.ts            # Weekly progress computation (main process)
  ipc-handlers.ts               # IPC bridge — exposes dashboard data to renderer
```

---

## Open Questions

- **Customization**: ~~Should students be able to rearrange Dashboard sections?~~ **Resolved**: Fixed section order for v1. No customization. Order: Priority Queue → Insight Cards → Upcoming Deadlines → Weekly Calendar → Grade Overview → Weekly Progress → Announcements.
- **Widgets**: ~~Is a widget/card-based system better than fixed sections?~~ **Resolved**: Fixed sections. Widget system deferred to v2.
- **Notifications**: ~~Should the Dashboard show a notification banner when a new grade is posted?~~ **Resolved**: No in-app banner. Grade chart animates the update via IPC push. Insight card fires if threshold is crossed. OS notification handles backgrounded state. Three signals is enough — no fourth banner.
- **Multiple semesters**: ~~How does the Dashboard handle semester transitions?~~ **Resolved**: Auto-archive by semester. Semester end is detected from the last assignment/class date in the Canvas syllabus data. On transition, old courses move to a visible archive (accessible from settings or a "Past Semesters" link). Dashboard only shows active semester. Memory System behavioral data (procrastination patterns etc.) persists across semesters.
- **Offline mode**: ~~When Canvas is unreachable, how stale can Dashboard data be before we visually indicate it's outdated?~~ **Resolved**: Always render from SQLite cache — never block on Canvas. Show a warning banner if last sync was 1–2 days ago.
- **Mobile companion**: ~~If Student Claw ever gets a mobile companion, the Dashboard is the most important view to replicate. Design with this in mind?~~ **Resolved**: Mobile companion is out of scope for v1. Phone component may exist for push notifications only. Dashboard is desktop-first.
