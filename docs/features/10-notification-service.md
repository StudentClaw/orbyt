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
| **Memory System** | Reads quiet hours and notification preferences (`agent_id="preferences"`) |
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

### 2. Notification Evaluator

Decides whether an event is worth notifying the student about. Not every change deserves a ping.

| Event | Notify? | Logic |
|---|---|---|
| New assignment posted | Always | Students need to know about new work |
| Deadline changed | Always | Critical for planning |
| Grade posted | Always | Students want grades immediately |
| Announcement posted | Conditional | Only if it contains keywords: exam, deadline, cancellation, final, midterm |
| Plan reminder | Configurable | X minutes before a planned session (default: 15 min) |
| Plan rescheduled | Always | Student needs to know their plan changed |

### 3. Notification Composer

Generates the notification text. Uses templates for simple events, AI for complex ones.

**Template-based** (no AI cost):
- Grade posted: "You got {score}/{max} on {assignment} in {course}"
- New assignment: "New assignment in {course}: {title}, due {date}"
- Deadline changed: "{assignment} in {course} — deadline moved to {newDate}"

**AI-composed** (uses Codex for natural, contextual messages):
- Deadline moved + plan needs rescheduling: "The deadline for your CS 301 essay moved up to Friday. I've adjusted your study plan — you now have a writing session tomorrow evening."
- Complex announcements: Summarize a long professor announcement into a 1-2 sentence notification

### 4. Delivery Layer

Sends notifications through Electron's native `Notification` API for OS-level visibility.

- **Native notifications**: macOS Notification Center, Windows Action Center
- **Click handling**: Clicking a notification opens the relevant section in Student Claw (grade → Dashboard grade view, assignment → assignment detail, plan change → calendar view)
- **Quiet hours enforcement**: Read quiet hours from memory (`agent_id="preferences"`). During quiet hours, queue notifications for delivery when quiet hours end.
- **Notification queue in SQLite**: Handles offline scenarios — if the app was closed when a Canvas sync detected changes, notifications are queued and shown on next app open.

### 5. Insight Generator

Periodic proactive analysis that surfaces AI-powered insights as cards on the Dashboard.

**Trigger**: Scheduled (e.g., Sunday evening), or when enough data has accumulated since the last insight generation.

**Process**:
1. Gather the week's data: completed sessions, skipped sessions, new grades, upcoming deadlines
2. Spin up Codex with this data and ask for 2-3 actionable insights
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
  priority        TEXT DEFAULT 'normal'  -- 'low', 'normal', 'high'
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
| SQLite notification queue | Handle offline/backlog, persist delivery state |

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

- **Notification fatigue**: How many notifications per day is too many? Should we implement daily caps or smart batching (group 3 grade notifications into one)?
- **Notification channels**: Should students be able to configure per-type notification settings (e.g., "always notify for grades, never for announcements")?
- **Mobile push**: If Student Claw ever gets a mobile companion, push notifications would be essential. Design the queue with this in mind?
- **Snooze**: Should notifications support snooze? "Remind me in 1 hour"?
- **Notification history**: Should there be a notification center in the app showing past notifications?
