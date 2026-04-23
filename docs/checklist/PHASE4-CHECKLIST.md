# Phase 4 Verification Checklist (Frontend)

## Activity State
- [ ] `activityState.ts` follows atom pattern: atoms, imperative getters/setters, hooks, sync starter, test reset
- [ ] `activityEntriesAtom` stores `ReadonlyArray<ActivityFeedEntry>` (newest first)
- [ ] `activityUnreadCountAtom` tracks unread count, incremented on new entry insert
- [ ] `activityFilterAtom` defaults to `"all"` and supports all `ActivityCategory` values plus `"all"`
- [ ] `applyActivityFeedUpsertEvent` adds new entries (prepended) and updates existing entries by ID without double-counting unread
- [ ] `markAllActivityRead` resets unread count to 0 without removing entries
- [ ] `filterActivityEntries` pure function returns all entries for `"all"` and filters by category otherwise
- [ ] `startActivityStateSync(client)` subscribes to `PUSH_CHANNELS.ACTIVITY_FEED`
- [ ] `resetActivityStateForTests` clears all activity atoms
- [ ] `bun --cwd packages/ui vitest run` passes activityState tests

## WsRpcClient Activity Module
- [ ] `WsRpcClient` interface includes `activity` namespace with `onFeedUpdate` subscription method
- [ ] `ActivityFeedUpsertEvent` interface defined with `entryId`, `title`, `category`
- [ ] `createActivityApi` subscribes to `PUSH_CHANNELS.ACTIVITY_FEED` using `RPC_METHODS.ACTIVITY_SUBSCRIBE_FEED`
- [ ] `appRuntime.ts` imports and calls `startActivityStateSync(client)` during boot
- [ ] `useAppRuntime.ts` exports `useRuntimeActivityEntries`, `useRuntimeActivityUnreadCount`, `useRuntimeActivityFilter`

## Onboarding State
- [ ] `onboardingState.ts` follows atom pattern with `onboardingWizardAtom`
- [ ] `ONBOARDING_STEPS` defines 7 steps: welcome, canvas-credential, ai-auth, preferences, routines, first-sync, dashboard-walkthrough
- [ ] `canvas-credential` and `ai-auth` steps are marked `required: true`
- [ ] `advanceOnboardingStep` increments step and marks current as `completed` with timestamp
- [ ] `skipOnboardingStep` marks step as `skipped` for non-required steps; no-ops for required steps
- [ ] `goToOnboardingStep` navigates to a clamped step index
- [ ] `setCanvasTokenValidated` and `setAiAuthStatus` update validation flags
- [ ] `completeOnboarding` sets `overallStatus` to `"completed"`
- [ ] `isOnboardingComplete` returns `true` only when `overallStatus === "completed"`
- [ ] `persistOnboardingState` serializes to `localStorage` key `orbyt:onboarding`
- [ ] `hydrateOnboardingState` restores from `localStorage`, handles missing/corrupted data gracefully
- [ ] `resetOnboardingStateForTests` clears wizard atom to initial state
- [ ] `bun --cwd packages/ui vitest run` passes onboardingState tests

## Onboarding Guard
- [ ] `AppShell.tsx` imports `useIsOnboardingComplete` and `useNavigate`
- [ ] `useEffect` redirects to `/onboarding` when `isOnboardingComplete` is false and path is not `/onboarding`
- [ ] Does not redirect when already on `/onboarding`
- [ ] Does not redirect when onboarding is complete
- [ ] `bun --cwd packages/ui vitest run` passes onboarding-guard tests

## Activity Badge
- [ ] `AppSidebar.tsx` imports `useRuntimeActivityUnreadCount`
- [ ] Badge renders next to "Activity" nav item when `unreadCount > 0`
- [ ] Badge shows exact count for counts <= 99
- [ ] Badge shows "99+" for counts > 99
- [ ] Badge is hidden when unread count is 0
- [ ] `bun --cwd packages/ui vitest run` passes AppSidebar-badge tests

## Onboarding Wizard
- [ ] `OnboardingWizard.tsx` renders progress bar, step label, step counter ("Step N of 7")
- [ ] Conditionally renders the correct step component based on `currentStep`
- [ ] Back button hidden on step 0; visible on step > 0
- [ ] Skip button hidden on required steps; visible on non-required steps
- [ ] Next button shows "Next" for all steps except the last, which shows "Finish"
- [ ] Finish calls `completeOnboarding()` and `persistOnboardingState()`
- [ ] `OnboardingPage.tsx` renders `<OnboardingWizard />`
- [ ] `bun --cwd packages/ui vitest run` passes OnboardingWizard tests

## Welcome Step
- [ ] `WelcomeStep.tsx` renders welcome content with value prop and privacy framing
- [ ] Shows "~5 min to set up" time estimate
- [ ] "Get Started" button calls `onNext`
- [ ] `bun --cwd packages/ui vitest run` passes WelcomeStep tests

## Canvas Credential Step
- [ ] `CanvasCredentialStep.tsx` renders split layout: instructions + form
- [ ] URL input validates against `https://*.instructure.com` pattern
- [ ] Token input validates minimum 20 character length
- [ ] Validate button shows success/error feedback via `canvas-validation-status`
- [ ] Successful validation calls `setCanvasTokenValidated(true)`
- [ ] `bun --cwd packages/ui vitest run` passes CanvasCredentialStep tests

## AI Auth Step
- [ ] `AiAuthStep.tsx` renders connect button and status card
- [ ] Status shows pending/connecting/connected/skipped
- [ ] Connect button disabled when connecting or connected
- [ ] Skip link calls `setAiAuthStatus("skipped")` and `onNext`
- [ ] `bun --cwd packages/ui vitest run` passes AiAuthStep tests

## Preferences Step
- [ ] `PreferencesStep.tsx` renders study time toggles (Morning/Afternoon/Evening)
- [ ] Max session duration selector with 30min-3hr options
- [ ] Off-limit day toggles (Mon-Sun)
- [ ] Notification enabled switch with quiet hours time inputs
- [ ] `bun --cwd packages/ui vitest run` passes PreferencesStep tests

## Routines Step
- [ ] `RoutinesStep.tsx` renders 7-day weekly grid (6am-9pm)
- [ ] Grid cells are clickable and toggle active/inactive state
- [ ] Day headers (Mon-Sun) visible
- [ ] `data-active` attribute reflects cell state
- [ ] `bun --cwd packages/ui vitest run` passes RoutinesStep tests

## First Sync Step
- [ ] `FirstSyncStep.tsx` triggers `canvas.sync()` on mount (once)
- [ ] Shows progress bar when sync is in progress
- [ ] Shows summary when sync is done
- [ ] Shows error message when sync fails
- [ ] `bun --cwd packages/ui vitest run` passes FirstSyncStep tests

## Dashboard Walkthrough
- [ ] `DashboardWalkthrough.tsx` renders `WalkthroughOverlay`
- [ ] `WalkthroughOverlay.tsx` shows step title, description, and step counter
- [ ] Next button advances through walkthrough steps
- [ ] Last step shows "Got it" instead of "Next"
- [ ] Dismiss button ends the walkthrough
- [ ] Completing walkthrough calls `completeOnboarding()` and `persistOnboardingState()`
- [ ] `walkthrough-steps.ts` defines 5 steps targeting dashboard section test IDs
- [ ] `bun --cwd packages/ui vitest run` passes DashboardWalkthrough and WalkthroughOverlay tests

## Activity Center
- [ ] `ActivityCenter.tsx` renders filter tabs (All/Canvas/Planner/Agent/Insights)
- [ ] Tab switching calls `setActivityFilter`
- [ ] Activity feed renders `ActivityFeedItem` for each entry
- [ ] "Mark all read" button calls `markAllActivityRead()`
- [ ] Empty state shows "No activity yet" when no entries
- [ ] Tab badge counts show per-category entry counts
- [ ] `ActivityPage.tsx` renders `<ActivityCenter />`
- [ ] `bun --cwd packages/ui vitest run` passes ActivityCenter tests

## Activity Feed Item
- [ ] `ActivityFeedItem.tsx` renders entry title, body, and category label
- [ ] Category label color-coded (canvas blue, planner green, workflow purple, insight amber)
- [ ] Deep link arrow indicator shown when `deepLink` present
- [ ] Clickable with navigation when `deepLink` present
- [ ] `bun --cwd packages/ui vitest run` passes ActivityFeedItem tests

## Notification Settings
- [ ] `NotificationSettings.tsx` renders master toggle, per-category toggles, quiet hours
- [ ] Category toggles: canvas, planner, workflow, insight
- [ ] Quiet hours inputs for start and end time
- [ ] Category toggles disabled when master toggle is off
- [ ] `bun --cwd packages/ui vitest run` passes NotificationSettings tests

## Native Notifications
- [ ] `useNativeNotification.ts` hook fires `notification:show` IPC for new high-priority entries (priority >= 3)
- [ ] Does not fire for low-priority or undefined-priority entries
- [ ] Does not re-fire for existing entries on re-render
- [ ] Hook called in `AppShell.tsx`
- [ ] `bun --cwd packages/ui vitest run` passes useNativeNotification tests

## Cross-Cutting
- [ ] `bun run typecheck` passes all packages after Phase 4 changes
- [ ] `bun --cwd packages/ui vitest run` passes all tests (Phase 0 + Phase 1 + Phase 2 + Phase 3 + Phase 4)
- [ ] `bun run dev:ui` — onboarding wizard loads, all 7 steps navigate, activity center shows feed
- [ ] No regression: all existing Phase 0-3 tests still pass
- [ ] No console.log statements in production code
- [ ] All new files under 800 lines, functions under 50 lines
- [ ] Immutable state patterns used throughout (spread operator, no mutation)
