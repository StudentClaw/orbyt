# Phase 2 Verification Checklist

## Contracts Extension
- [ ] `RPC_METHODS` includes `CANVAS_GET_COURSES`, `CANVAS_SYNC`, `DASHBOARD_REFRESH`, `PLANNER_GET_SESSIONS`, `PLANNER_CHECK_IN`
- [ ] `PUSH_CHANNELS` includes `CANVAS_SYNC_PROGRESS`, `DASHBOARD_UPDATE`, `PLANNER_SESSION_CHECK_IN`, `ACTIVITY_FEED`
- [ ] `PlannedSession` schema includes `sessionLabel`, `courseId`, `courseName`, `assignmentTitle` fields
- [ ] `bun run build:shared` succeeds for `packages/contracts`
- [ ] `bun test --cwd packages/contracts` passes with new constants

## Canvas State
- [ ] `canvasState.ts` follows atom pattern from `orchestrationState.ts`: atoms, imperative getters/setters, hooks, sync starter, test reset
- [ ] `setCourses` stores and `getCourses` retrieves courses correctly
- [ ] `applyCanvasSyncProgressEvent` updates sync progress atom with courseId, progress, and status
- [ ] `computeStaleness` returns `"fresh"` when lastSync < 24h, `"stale"` when > 24h, `"offline"` when null
- [ ] `getUpcomingDeadlines` filters and sorts coursework items by `effectiveDueAt` within window
- [ ] `startCanvasStateSync(client)` subscribes to `canvas.syncProgress` push channel and processes events
- [ ] `resetCanvasStateForTests` clears all canvas atoms to initial values
- [ ] `bun --cwd packages/ui vitest run` passes canvasState tests

## Dashboard State
- [ ] `dashboardState.ts` manages section update timestamps and loading/error states per section
- [ ] `startDashboardStateSync(client)` subscribes to `dashboard.update` push channel
- [ ] `resetDashboardStateForTests` clears all dashboard atoms
- [ ] `bun --cwd packages/ui vitest run` passes dashboardState tests

## Dashboard Layout + Grades
- [ ] `DashboardLayout.tsx` renders section slots in fixed order: Priority Queue, Insight Cards, Upcoming Deadlines, Weekly Calendar, Grade Overview, Weekly Progress, Announcements, Quick Actions
- [ ] Each section slot shows a loading skeleton when its data is not yet available
- [ ] `DashboardPage.tsx` renders `<DashboardLayout>` instead of stub content
- [ ] `computeGradeTrend` returns `"up"` when weighted grade movement > +1%, `"stable"` for ±1%, `"down"` for < -1% over last 3-4 graded items
- [ ] `computeCourseGradePercentage` returns correct weighted average (score/maxScore)
- [ ] `GradeOverview.tsx` renders a card for each course showing letter grade, percentage, and trend arrow
- [ ] `GradeOverview.tsx` shows "No grades yet" empty state
- [ ] `GradeChart.tsx` renders recharts `LineChart` for grade trajectory per course
- [ ] `bun --cwd packages/ui vitest run` passes dashboard-model and GradeOverview tests

## Deadline Timeline
- [ ] `groupDeadlinesByDay` groups coursework items by date string within a 14-day window
- [ ] `computeUrgencyZone` returns `"calm"` (7+ days), `"attention"` (3-6 days), `"urgent"` (1-2 days), `"overdue"` (past due)
- [ ] `formatCountdown` produces human-readable strings ("3 days", "12 hours", "Overdue")
- [ ] `DeadlineTimeline.tsx` renders day columns for the next 14 days
- [ ] Items placed in correct day columns with urgency color coding
- [ ] "+N more" chip appears when a day has more than 3 items
- [ ] Day popover expands on click showing full day details
- [ ] "No upcoming deadlines" shown when empty
- [ ] `bun --cwd packages/ui vitest run` passes DeadlineTimeline tests

## Announcements Feed
- [ ] `AnnouncementsFeed.tsx` renders announcement cards sorted by date (newest first)
- [ ] `AnnouncementCard.tsx` shows course label, professor, timestamp, truncated body
- [ ] Clicking a card expands to show full body text
- [ ] Read/unread state has visual distinction (opacity, badge, or similar)
- [ ] "No announcements" shown when empty
- [ ] `bun --cwd packages/ui vitest run` passes AnnouncementsFeed tests

## Connection State Indicators
- [ ] `StaleBanner.tsx` appears when `computeStaleness` returns `"stale"` (last sync > 24h ago)
- [ ] `StaleBanner.tsx` hidden when data is fresh or when a sync is in progress
- [ ] `SyncProgressIndicator.tsx` appears during an active canvas sync (syncProgress status = "syncing")
- [ ] `SyncProgressIndicator.tsx` hidden when sync completes or errors

## Integration
- [ ] `appRuntime.ts` calls `startCanvasStateSync(client)` and `startDashboardStateSync(client)` during boot
- [ ] `useAppRuntime.ts` exports `useRuntimeCourses`, `useRuntimeGrades`, `useRuntimeCourseworkItems`, `useRuntimeCanvasSyncProgress`
- [ ] `wsRpcClient.ts` has `canvas` and `dashboard` namespace sections with subscriptions and RPC methods
- [ ] `useDashboard.ts` hook provides thin facade over canvas + dashboard state

## Cross-Cutting
- [ ] `bun run typecheck` passes all packages after Phase 2 changes
- [ ] `bun --cwd packages/ui vitest run` passes all tests (existing + new)
- [ ] `bun run dev:ui` renders Dashboard with grade overview, deadline timeline, announcements feed, and connection indicators
- [ ] No console.log statements in production code
- [ ] All new files under 800 lines, functions under 50 lines
