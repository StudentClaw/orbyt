# Feature 10: Proactive Notification Service

## What It Is

The Notification Service bridges background intelligence to the student's attention. It listens for events from Canvas sync and the Smart Planner, evaluates whether they're worth notifying about, composes appropriate messages, and delivers them through native OS notifications. It also generates periodic AI-powered insight cards for the Dashboard.

---

## Why It Exists

Students miss things. A new assignment posted at 2 AM, a deadline quietly moved forward, a grade posted while they're in class. The Notification Service ensures the student never misses anything important — without overwhelming them with noise. It respects their preferences (quiet hours, notification types) and uses AI to generate contextual messages for complex events.

---

## Dependencies

```
Canvas Integration ──→ Notification Service (change events)
Smart Planner ───────→ Notification Service (session reminders)
Memory System ───────→ Notification Service (quiet hours, preferences)
AI Harness ──────────→ Notification Service (contextual messages, insights)
Electron Shell ──────→ Notification Service (native OS notification API)
```

| Depends On | Why |
|---|---|
| **Canvas Integration** | Subscribes to typed change events (`AssignmentAdded`, `DeadlineChanged`, `GradePosted`, `AnnouncementPosted`) |
| **Smart Planner** | Session reminders (X minutes before a planned study session) |
| **Memory System** | Reads quiet hours and per-type notification preferences (`agent_id="preferences"`) |
| **AI Harness** | Generates contextual notification text for complex events; powers weekly insight analysis |
| **Electron Shell** | Electron `Notification` API for native OS notifications |

| Depended On By | Why |
|---|---|
| **Dashboard** | Insight cards displayed as a horizontal strip on the home screen |

---

## Core Responsibilities

### 1. Event Listener

Subscribes to event streams from other features.

**Canvas change events** (from [Canvas Integration](02-canvas-integration.md)):
- `AssignmentAdded` — New assignment posted in any course
- `DeadlineChanged` — Due date modified on an existing assignment
- `GradePosted` — New score/grade appears on a submission
- `AnnouncementPosted` — New announcement in any course

**Planner events** (from [Smart Planner](09-smart-planner.md)):
- `SessionReminder` — Upcoming study session in X minutes
- `PlanRescheduled` — Plan was automatically adjusted due to a Canvas change
- `SessionCheckIn` — Fired at +9 min and +30 min after session end; prompts the student to report completion status (Yes / No / Yes, but...)

### Announcement Filtering

Two-stage pipeline:

1. **Fuzzy keyword match** (free, instant) — uses approximate string matching (Levenshtein distance) to catch typos and near-matches. Keywords:
   - `exam`, `quiz`, `test`, `midterm`, `final`, `finals`
   - `deadline`, `due date`, `due by`
   - `cancellation`, `cancelled`, `canceled`, `rescheduled`
   - `grade`, `grades`, `graded`
   - `office hours`, `extra credit`
   - `important`, `urgent`

2. **AI classification fallback** (Haiku) — if fuzzy match returns negative, run an AI call to determine if the announcement is worth notifying about. If AI also returns negative, drop silently.

---

### 2. Notification Evaluator

Decides whether an event is worth notifying the student about. Not every change deserves a ping.

| Event | Notify? | Logic |
|---|---|---|
| New assignment posted | Always | Students need to know about new work |
| Deadline changed | Always | Critical for planning |
| Grade posted | Always | Students want grades immediately |
| Announcement posted | Conditional | Fuzzy keyword match first; if negative, AI classification fallback (see Announcement Filtering) |
| Plan reminder | Configurable | Single reminder per session, 5–60 min before (5-min increments, default: 15 min) |
| Plan rescheduled | Always | Student needs to know their plan changed |
| Session check-in | Always | Two notifications per session: +9 min and +30 min after end. Both silenced once the student checks in. |

### Batching Rules

When a single sync run produces 3 or more notifications of the same type, they are collapsed into one batched notification:
- **Title**: e.g., "5 New Assignments"
- **Body**: e.g., "5 new assignments added across your courses."
- **Deep link**: filtered view showing all items of that type
- Under 3 of the same type: send individually (context outweighs brevity)

---

### 3. Notification Composer

Generates the notification text. Uses templates for simple events, AI for complex ones.

**Template-based** (no AI cost):
- Grade posted: "You got {score}/{max} on {assignment} in {course}"
- New assignment: "New assignment in {course}: {title}, due {date}"
- Deadline changed: "{assignment} in {course} — deadline moved to {newDate}"

**AI-composed** (uses Haiku for natural, contextual messages):

Triggered only when two or more events are causally linked in the same processing batch (same assignment, same course). A single isolated event always uses a template — AI's role is to stitch related events into one coherent message.

- Deadline moved + plan rescheduled (same assignment): "The deadline for your CS 301 essay moved up to Friday. I've adjusted your study plan — you now have a writing session tomorrow evening."
- Complex announcements that passed the AI classification stage: Summarize into a 1-2 sentence notification

### 4. Delivery Layer

Sends notifications through Electron's native `Notification` API for OS-level visibility.

- **Native notifications**: macOS Notification Center, Windows Action Center
- **Click handling**: Clicking a notification deep-links into the relevant section:

  | Notification type | Deep link |
  |---|---|
  | `AssignmentAdded` | `/assignments/{assignmentId}` |
  | `DeadlineChanged` | `/assignments/{assignmentId}` |
  | `GradePosted` | `/courses/{courseId}/grades` |
  | `AnnouncementPosted` | `/courses/{courseId}/announcements/{announcementId}` |
  | `SessionReminder` | `/planner/calendar` |
  | `PlanRescheduled` | `/planner/calendar` |
  | `SessionCheckIn` | `/dashboard` (check-in prompt) |
  | Batched `AssignmentAdded` | `/assignments?filter=new` |
  | `insight` | `/dashboard` |
- **Quiet hours enforcement**: Read quiet hours from memory (`agent_id="preferences"`). During quiet hours, queue `normal` and `low` priority notifications for delivery when quiet hours end. `high` priority notifications bypass quiet hours and are delivered immediately.
- **Per-type toggles**: Students can enable/disable each notification type individually via preferences. All types default to on. Toggles stored in memory (`agent_id="preferences"`):
  - New assignments, Deadline changes, Grades posted, Announcements, Study session reminders, Plan rescheduled, Weekly insights
- **Notification queue in SQLite**: Handles offline scenarios — if the app was closed when a Canvas sync detected changes, notifications are queued and shown on next app open.

### 5. Insight Generator

Periodic proactive analysis that surfaces AI-powered insights as cards on the Dashboard.

**Trigger**: Fires when ANY of the following conditions are met since the last insight run:

| Category | Trigger |
|---|---|
| **Study behaviour** | 3+ completed or skipped study sessions |
| **Grade events** | 5+ new grades posted; OR any grade ≥10 pts below the student's course average |
| **Deadline pressure** | 3+ deadlines landing in the next 7 days; OR a deadline within 72h with no study session planned |
| **Course milestone** | Every course has had at least 1 exam graded (mid-semester check-in) |
| **Time-based** | Every Sunday evening (hard minimum — guaranteed at least once per week) |

The Sunday evening time-based run always includes a **weekly recap** card: upcoming deadlines, planned sessions, and any unplanned work due soon — so the student is always oriented even during quiet weeks.

**Process**:
1. Gather the week's data: completed sessions, skipped sessions, new grades, upcoming deadlines
2. Call Haiku with this data and ask for 2-3 actionable insights
3. Store insights in the notification queue with type `"insight"`
4. Surface as cards on the [Dashboard](06-dashboard.md)

**Example insights**:
- "You have 3 deadlines next week — want to start planning?"
- "Your grades in CS 301 have been trending up over the last 3 assignments."
- "You've been skipping Sunday study sessions 3 weeks in a row — want to reschedule those to a different day?"
- "Your Bio essay is due in 5 days and you haven't started. Last time a similar essay took you 6 hours."

---

## Data Model (SQLite)

### `notification_queue` table

```
notification_queue
  id              INTEGER PRIMARY KEY AUTOINCREMENT
  type            TEXT NOT NULL       -- 'deadline_reminder', 'grade_posted', 'assignment_added',
                                      --  'deadline_changed', 'announcement', 'plan_reminder',
                                      --  'plan_rescheduled', 'insight'
  title           TEXT NOT NULL
  body            TEXT NOT NULL
  priority        TEXT DEFAULT 'normal'  -- 'low': announcements, insights
                                      -- 'normal': new assignments, passing grades, plan changes, reminders
                                      -- 'high': deadline changed (≤48h away), failing grade (<60%) — bypasses quiet hours
  scheduled_for   DATETIME            -- when to deliver (null = immediately)
  delivered       INTEGER DEFAULT 0   -- whether notification was shown
  delivered_at    DATETIME
  clicked         INTEGER DEFAULT 0   -- whether student clicked on it
  deep_link       TEXT                -- where to navigate on click (e.g., '/dashboard/grades')
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
```

---

## Technology

| Library | Purpose |
|---|---|
| Electron `Notification` API | Native OS notifications (macOS Notification Center, Windows Action Center) |
| Effect-TS `Schedule` | Timed reminders, periodic insight generation |
| Effect-TS `PubSub` | In-process event delivery from Canvas Integration and Smart Planner |
| SQLite notification queue | Handle offline/backlog, persist delivery state |

## Event Delivery Architecture

Live events use **Effect-TS `PubSub`** for in-process delivery (low-latency, no overhead). Canvas Integration also writes change records to SQLite as a durable log. On app startup, the Notification Service replays any unprocessed change records — catching anything missed while the app was closed — before subscribing to the live pubsub stream.

---

## Proposed File Structure

```
packages/server/src/notifications/
  NotificationService.ts      # Effect service: orchestrates the notification pipeline
  EventListener.ts            # Subscribes to Canvas and Planner event streams
  NotificationEvaluator.ts    # Decides whether to notify (rules engine)
  NotificationComposer.ts     # Template-based + AI-composed message generation
  InsightGenerator.ts         # Periodic AI analysis for dashboard insight cards
  QuietHours.ts               # Quiet hours enforcement, queue management

packages/electron/src/notifications/
  NativeNotification.ts       # Electron Notification API wrapper
  DeepLinkHandler.ts          # Navigate to relevant section on notification click
```

---

## Open Questions

- ~~**Notification fatigue**~~: No daily cap — important notifications must always get through. Fatigue is managed through per-type toggles, quiet hours, and same-type batching (3+ per sync run). ✅
- ~~**Notification channels**~~: Global per-type toggles only. No per-course muting. ✅
- ~~**Mobile push**~~: Schema kept lean for Electron only. Mobile push deferred until a mobile companion is actually planned. ✅
- ~~**Snooze**~~: No snooze support. ✅
- ~~**Notification history**~~: In-app notification history panel on the Dashboard. Shows last 30 days of delivered notifications grouped by day; unclicked items visually distinct. SQLite records auto-purged after 30 days. ✅
