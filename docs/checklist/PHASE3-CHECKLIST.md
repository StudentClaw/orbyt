# Phase 3 Verification Checklist

## Planner State
- [ ] `plannerState.ts` follows atom pattern: atoms, imperative getters/setters, hooks, sync starter, test reset
- [ ] `plannedSessionsAtom` stores and retrieves `ReadonlyArray<PlannedSession>`
- [ ] `pendingCheckInsAtom` tracks pending check-in prompts with sessionId and triggeredAt
- [ ] Pending check-ins capped at 3; 4th triggers FIFO eviction of oldest to "skipped" status
- [ ] `plannerStreamingAtom` tracks streaming plan generation state (status, currentStage, sessionsPlaced, totalExpected)
- [ ] `calendarViewWeekAtom` tracks the active week start date for calendar navigation
- [ ] `applySessionCheckInEvent` correctly processes `planner.sessionCheckIn` events
- [ ] `startPlannerStateSync(client)` subscribes to planner push channels
- [ ] `resetPlannerStateForTests` clears all planner atoms
- [ ] `bun --cwd packages/ui vitest run` passes plannerState tests

## Priority Queue
- [ ] `sortByPriority` implements 3-layer priority model: Layer 1 urgency gate (RED/YELLOW/GREEN), Layer 2 impact score within zone, Layer 3 effort tiebreaker within ±0.05 epsilon
- [ ] RED zone: `hours_remaining < estimated_effort_hours * 1.5` — sorted by earliest deadline
- [ ] YELLOW zone: `hours_remaining < 48` — sorted by impact score (grade_impact × course_priority)
- [ ] GREEN zone: all others — sorted by impact score
- [ ] Within ±0.05 impact epsilon: shorter estimated effort sorts first (WSJF)
- [ ] `computePriorityDisplay` returns correct urgency zone color for each zone
- [ ] `PriorityQueue.tsx` renders top 5-7 items sorted by priority model
- [ ] `PriorityCard.tsx` shows: assignment title, course name, countdown chip, urgency badge (color-coded), estimated hours, progress indicator
- [ ] Urgency colors match spec: calm (green, 7+ days), attention (yellow, 3-6 days), urgent (orange, 1-2 days), overdue (red)
- [ ] `bun --cwd packages/ui vitest run` passes priority-model and PriorityQueue tests

## Weekly Calendar
- [ ] `sessionToGridPlacement` maps session start/end times to grid column (day) and row span based on 15-minute snap grid
- [ ] `detectConflicts` identifies overlapping sessions and returns conflict pairs
- [ ] `detectConflicts` returns empty array for non-overlapping sessions
- [ ] `getWeekDates` returns 7 ISO date strings for the active week
- [ ] `navigateWeek` moves the week start forward/backward by 7 days
- [ ] `getSessionsForWeek` correctly filters sessions belonging to the active week
- [ ] `WeeklyCalendar.tsx` renders a 7-day grid with 15-minute row resolution
- [ ] Sessions render as colored blocks in correct time positions
- [ ] Course color coding is consistent and derived from course ID
- [ ] Conflicting sessions render as side-by-side split columns with red border and "Schedule conflict" warning chip
- [ ] Clicking a session shows a details popover: assignment name, duration, session label
- [ ] Details popover includes a "Reschedule" action that opens the chat Sheet with prefilled context
- [ ] Week navigation (prev/next) updates the calendar view
- [ ] Deadline markers overlaid on the calendar for context
- [ ] `bun --cwd packages/ui vitest run` passes calendar-model and WeeklyCalendar tests

## Completion Check-in
- [ ] `CompletionCheckin.tsx` renders session title and three outcome buttons: Yes, No, Yes-but
- [ ] "Yes" calls `onComplete` with `{ status: "completed" }`
- [ ] "No" calls `onComplete` with `{ status: "skipped" }`
- [ ] "Yes, but..." reveals a text input field; submitting calls `onComplete` with `{ status: "partial", note: "..." }`
- [ ] Dialog is dismissible (click outside, Escape key, or explicit close button)
- [ ] Check-in is non-blocking — dismissed if the student navigates away
- [ ] `bun --cwd packages/ui vitest run` passes CompletionCheckin tests

## Weekly Progress
- [ ] `computeStreak` returns consecutive days with at least one completed session
- [ ] Days with no scheduled sessions are skipped without breaking the streak
- [ ] Missing a scheduled day (session exists but not completed/partial) resets streak to 0
- [ ] `computeCompletionRatio` returns `{ completed, total, percentage }` for sessions in a given week
- [ ] `computeWeekOverWeek` returns `{ delta, direction }` comparing this week vs last week completion percentages
- [ ] `WeeklyProgress.tsx` shows completed vs planned ratio with progress bar
- [ ] Streak count is visible
- [ ] Week-over-week comparison shows delta direction (up/same/down indicator)
- [ ] `bun --cwd packages/ui vitest run` passes progress-model and WeeklyProgress tests

## Insight Cards
- [ ] `InsightCards.tsx` renders as horizontal `ScrollArea` with AI insight cards
- [ ] Each `InsightCard.tsx` shows title, body, and optional action button
- [ ] Action button on card calls provided callback when clicked
- [ ] "No insights yet" shown when the insights array is empty
- [ ] `bun --cwd packages/ui vitest run` passes InsightCards tests

## Quick Actions
- [ ] `QuickActions.tsx` renders compact action buttons: "Plan my week", "Help with...", "What's most important?"
- [ ] Clicking "Plan my week" opens chat Sheet with plan-mode context prefilled
- [ ] Clicking "Help with [assignment]" opens chat Sheet with assignment context loaded
- [ ] Clicking "What's most important?" opens chat Sheet with priority context
- [ ] Actions disabled when connection state is not `"connected"`
- [ ] `bun --cwd packages/ui vitest run` passes QuickActions tests

## Streamed Planning UX
- [ ] `PlannerStreamOverlay.tsx` shows progress during AI plan generation with student-friendly stage messages
- [ ] Stage messages map correctly: `task.analyzing` → "Looking at your [title]...", `slot.finding` → "Checking your schedule...", `session.placing` → "Scheduling a session...", `plan.complete` → "Your plan is ready!"
- [ ] Unknown/unmapped stages are silently skipped (no raw implementation details exposed)
- [ ] Cancel button aborts planning and shows appropriate message
- [ ] Calendar assembles incrementally as sessions stream in from the planner
- [ ] Streaming state tracked via `plannerStreamingAtom` with status, currentStage, sessionsPlaced, totalExpected

## Integration
- [ ] `appRuntime.ts` calls `startPlannerStateSync(client)` during boot
- [ ] `useAppRuntime.ts` exports `useRuntimePlannedSessions`, `useRuntimePendingCheckIns`
- [ ] `wsRpcClient.ts` has `planner` namespace with session check-in subscription and RPC methods
- [ ] `useDashboard.ts` hook includes planner data accessors
- [ ] `DashboardLayout.tsx` renders all 8 sections in correct fixed order with Phase 3 components wired in

## Cross-Cutting
- [ ] `bun run typecheck` passes all packages after Phase 3 changes
- [ ] `bun --cwd packages/ui vitest run` passes all tests (Phase 0 + Phase 1 + Phase 2 + Phase 3)
- [ ] `bun run dev:ui` renders complete Dashboard: Priority Queue, Insight Cards, Deadlines, Calendar, Grades, Progress, Announcements, Quick Actions
- [ ] Visual verification: urgency colors correct, calendar blocks positioned correctly, streak counter works, trend arrows match grade data
- [ ] Interaction verification: deadline popover, calendar session click/reschedule, completion check-in flow, quick actions open chat sheet, planner streaming overlay
- [ ] No console.log statements in production code
- [ ] All new files under 800 lines, functions under 50 lines
- [ ] Immutable state patterns used throughout (spread operator, no mutation)
