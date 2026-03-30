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

**Priority score factors:**
- **Deadline proximity**: Closer = higher priority
- **Estimated effort**: Larger tasks need earlier starts
- **Grade weight**: A final paper worth 30% ranks above a 2% participation post
- **Student history**: If the student tends to procrastinate on essays, those get boosted earlier
- **Current progress**: Started but incomplete work gets a boost

**Display:**
- Card-based layout, top 5-7 items
- Each card shows: assignment title, course, due date (with countdown), estimated hours, progress indicator
- Color-coded urgency: calm (7+ days), attention (3-6 days), urgent (1-2 days), overdue (red)

### 2. Grade Overview

Per-course grade tracking with trend analysis.

- **Current grades**: Letter grade + percentage per course
- **Trend arrows**: Improving, stable, or declining based on last 3-4 graded items
- **Grade chart**: Line chart showing grade trajectory over the semester
- **GPA projection**: Estimated semester GPA based on current grades and remaining work weight

### 3. Upcoming Deadlines

A timeline/calendar strip view of the next 14 days.

- Visual timeline with assignments placed by due date
- Stacked bars for days with multiple deadlines
- Click to expand and see assignment details
- Integrates with plan-mode: if a study plan exists, show scheduled study blocks alongside deadlines

### 4. Weekly Progress

How much the student accomplished this week vs. planned.

- **Assignments completed**: Count with progress bar toward weekly goal
- **Study time logged**: Hours spent vs. planned (from plan-mode or manual tracking)
- **Streak**: Consecutive days with study activity
- **Comparison**: This week vs. last week

### 5. Announcements Feed

Recent announcements from all courses, sorted by date.

- Professor name, course, timestamp
- Truncated body with expand-to-read
- Mark as read/unread
- AI summary option: "Summarize this announcement" triggers a quick AI call

### 6. Weekly Calendar View

A visual calendar showing planned study sessions from the [Smart Planner](09-smart-planner.md).

- Shows the current week with study sessions as colored blocks
- Color-coded by course (consistent colors across the app)
- Tap a session to see details: assignment name, estimated duration, session label ("Research phase", "Writing session 2/3")
- Tap to trigger rescheduling ("Can't do this tonight" → Smart Planner finds alternative slots)
- Deadline markers overlaid on the calendar for context

### 7. Completion Check-ins

At the scheduled end of a study session (or when the student opens the app), show a three-way completion prompt:

| Response | What Happens |
|---|---|
| **Yes** | Mark session done, update daily memory, increment progress tracking |
| **No** | Reschedule the session, adjust downstream sessions in the plan |
| **Yes, but...** | Capture the student's note (e.g., "finished reading but didn't start writing"), partial reschedule, feed note into memory for future planning accuracy |

Check-ins are non-blocking — dismissed if the student navigates away. Missed check-ins are shown on next app open.

### 8. Proactive Insight Cards

AI-generated insight cards surfaced by the [Notification Service](10-notification-service.md) when relevant.

- "You have 3 deadlines next week — want to start planning?"
- "Your grades in CS 301 have been trending up — nice work."
- "You've been skipping Sunday study sessions — want to reschedule those?"

Cards are generated periodically (e.g., Sunday evening) by spinning up Codex with the week's data and asking for insights. They appear as a horizontal scrollable strip at the top of the Dashboard.

### 9. Quick Actions

One-click actions that open the Chat with pre-filled context.

- "Plan my week" → Opens chat with plan-mode activated
- "Help with [assignment name]" → Opens chat with assignment context loaded
- "What's most important right now?" → Opens chat with priority context

---

## Data Flow

### Initial load
```
App opens
  → Dashboard requests cached data from SQLite (instant)
  → Renders with cached data
  → Background sync triggers Canvas refresh
  → New data arrives via WebSocket push
  → Dashboard updates incrementally (no full reload)
```

### Real-time updates
```
Canvas sync detects new grade
  → Server pushes `grade.updated` via WebSocket
  → Dashboard's grade chart animates the update
  → Notification badge appears if the app was in background
```

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

| Library | Purpose |
|---|---|
| `recharts` or `victory` | Lightweight React charting for grade trajectories and progress visualization |
| WebSocket subscription | Real-time updates when Canvas syncs or plan changes |
| Effect Schema | Typed WebSocket event contracts shared between server and UI |

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

packages/server/src/dashboard/
  DashboardService.ts           # Effect service: aggregate data for dashboard
  PriorityScorer.ts             # Calculate priority scores for assignments
  GradeAnalyzer.ts              # Trend analysis, GPA projection
  ProgressTracker.ts            # Weekly progress computation
```

---

## Open Questions

- **Customization**: Should students be able to rearrange Dashboard sections? Hide sections they don't care about?
- **Widgets**: Is a widget/card-based system (like macOS widgets) better than fixed sections?
- **Notifications**: When a new grade is posted, should the Dashboard show a notification banner, or is the system tray notification enough?
- **Multiple semesters**: How does the Dashboard handle semester transitions? Archive old data? Show a semester picker?
- **Offline mode**: When Canvas is unreachable, how stale can Dashboard data be before we visually indicate it's outdated?
- **Mobile companion**: If Student Claw ever gets a mobile companion, the Dashboard is the most important view to replicate. Design with this in mind?
