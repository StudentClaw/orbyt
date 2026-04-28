<!-- Generated: 2026-04-27 | Files scanned: 10 | Token estimate: ~420 -->

# Frontend Components Codemap

## Page Tree (TanStack Router)

**Base File**: `/packages/ui/src/router.tsx`

```
/
├── /dashboard           → DashboardPage
├── /chat/:threadId      → ChatPage
├── /chat                → ChatIndexPage (create or select thread)
├── /onboarding          → OnboardingPage
│   ├── /onboarding/dna-discovery
│   ├── /onboarding/canvas-sync
│   ├── /onboarding/ai-connect
│   ├── /onboarding/preferences
│   └── /onboarding/routines
├── /settings            → SettingsPage
│   ├── /settings/general
│   ├── /settings/privacy
│   └── /settings/advanced
└── /canvas              → CanvasPage (course browser)
```

## Dashboard Components

**Root**: `/packages/ui/src/pages/DashboardPage.tsx`

| Component | File | Purpose |
|-----------|------|---------|
| `DashboardPage` | pages/DashboardPage.tsx | Main page; filters + layout |
| `DashboardShell` | components/dashboard/DashboardShell.tsx | Layout wrapper (header, sidebar, grid) |
| `DashboardHeader` | components/dashboard/DashboardHeader.tsx | Title, filters, refresh button |
| `DashboardFilterTabs` | components/dashboard/DashboardFilterTabs.tsx | All/Pending/Overdue/Upcoming tabs |
| `SubjectBlock` | components/dashboard/SubjectBlock.tsx | Course card group (with grade badge) |
| `AiInsightCard` | components/dashboard/AiInsightCard.tsx | Generated weekly insight widget |
| `GradeInsightsWidget` | components/dashboard/GradeInsightsWidget.tsx | Grade breakdown chart |
| `WeeklyOutlookWidget` | components/dashboard/WeeklyOutlookWidget.tsx | 7-day assignment outlook |
| `AssignmentGrid` | components/dashboard/AssignmentGrid.tsx | Pending/submitted assignment list |
| `AnnouncementsFeed` | components/dashboard/AnnouncementsFeed.tsx | Activity feed (announcements) |
| `AnnouncementCard` | components/dashboard/AnnouncementCard.tsx | Single announcement item |

**Key Hooks** (in `/packages/ui/src/hooks/`):
- `useDashboard()` — fetches courses, assignments, grades
- `useOrchestrationActions()` — workspace/thread management
- `useRuntimeOrchestrationSnapshot()` — subscribe to turn updates
- `useCardWeights()` — get student DNA card weights

## Onboarding Components

**Root**: `/packages/ui/src/pages/OnboardingPage.tsx`

| Component | File | Purpose |
|-----------|------|---------|
| `OnboardingWizard` | components/onboarding/OnboardingWizard.tsx | Multi-step form controller |
| `AiConnectPhase` | components/onboarding/phases/AiConnectPhase.tsx | OAuth/Codex setup |
| `CanvasSyncPhase` | components/onboarding/phases/CanvasSyncPhase.tsx | Canvas token + sync test |
| `DnaDiscoveryPhase` | components/onboarding/phases/DnaDiscoveryPhase.tsx | Quiz → archetype classification |
| `PreferencesPhase` | components/onboarding/phases/PreferencesPhase.tsx | Study times, course ranking |
| `RoutinesPhase` | components/onboarding/phases/RoutinesPhase.tsx | Weekly study grid |

**Key Hooks**:
- `useOnboardingState()` — step status, overall completion
- `useDnaClassifier()` — call classifyDna RPC
- `useStudentPreferences()` — get/set preferences

## Chat Components

**Root**: `/packages/ui/src/pages/ChatPage.tsx`

| Component | File | Purpose |
|-----------|------|---------|
| `ChatPage` | pages/ChatPage.tsx | Thread view + message list + input |
| `ChatShell` | components/chat/ChatShell.tsx | Layout (sidebar, main area, AI panel) |
| `MessageList` | components/chat/MessageList.tsx | Render turns in thread |
| `MessageItem` | components/chat/MessageItem.tsx | Single turn (input + output) |
| `ChatInput` | components/chat/ChatInput.tsx | Form for new turn (file attach, skill select) |
| `ProviderStatus` | components/runtime/ProviderStatus.tsx | Codex connection indicator |
| `ArtifactRenderer` | components/artifacts/ | Render code/canvas artifacts |

**Key Hooks**:
- `useChat()` — get thread, send turn, interrupt
- `useRuntimeOrchestrationSnapshot()` — stream provider tokens
- `useFileAttachment()` — upload + metadata lookup

## Settings Components

**Root**: `/packages/ui/src/pages/SettingsPage.tsx`

| Component | File | Purpose |
|-----------|------|---------|
| `SettingsPage` | pages/SettingsPage.tsx | Tab navigation |
| `GeneralSection` | components/settings/GeneralSection.tsx | App info, theme toggle |
| `PreferencesSection` | components/settings/PreferencesSection.tsx | Study times, routines |
| `PrivacySection` | components/settings/PrivacySection.tsx | Data export, reset options |
| `CanvasSettings` | components/settings/CanvasSettings.tsx | Canvas token management |

## State Management

**RPC Client**: `/packages/ui/src/rpc/wsRpcClient.ts`

```typescript
// Request-response
await wsRpcClient.orchestration.sendTurn({threadId, content, attachments})
await wsRpcClient.onboarding.classifyDna({answers})

// Subscriptions (streaming)
wsRpcClient.orchestration.subscribeDomain((event) => {
  // OrchestrationDomainEvent: workspace/thread/turn updates
})
wsRpcClient.provider.subscribeRuntime((event) => {
  // ProviderRuntimeEvent: tokens, reasoning, approvals
})
```

**Query State** (TanStack Query):
- `useQuery(['dashboard', 'assignments'])` — upcoming assignments
- `useQuery(['canvas', 'courses'])` — course list
- `useQuery(['onboarding', 'snapshot'])` — onboarding state

**Store State** (Zustand):
- `useAuthStore()` — AI auth status, provider info
- `useDashboardStore()` — filter selection, view mode
- `useOrchestrationStore()` — current workspace/thread ID

## Component Hierarchy

```
App (router)
├── DashboardPage
│   └── DashboardShell
│       ├── DashboardHeader (filters)
│       ├── DashboardFilterTabs
│       └── [SubjectBlock, GradeInsightsWidget, AnnouncementsFeed, ...]
├── ChatPage
│   └── ChatShell
│       ├── ThreadList (sidebar)
│       ├── MessageList + MessageItems
│       └── ChatInput
├── OnboardingPage
│   └── OnboardingWizard
│       ├── AiConnectPhase
│       ├── DnaDiscoveryPhase
│       └── PreferencesPhase
└── SettingsPage
    ├── GeneralSection
    └── PreferencesSection
```

## Key Hooks (Custom)

**File**: `/packages/ui/src/hooks/`

| Hook | Purpose | Returns |
|------|---------|---------|
| `useDashboard()` | Fetch courses, assignments, grades from server | {courses, upcomingAssignments, submissionStatus, grades} |
| `useOrchestrationActions()` | Create/rename/delete workspace/thread | {createWorkspace, sendTurn, interruptTurn, ...} |
| `useRuntimeOrchestrationSnapshot()` | Subscribe to orchestration domain events | {workspace, threads, turns, isUpdating} |
| `useCardWeights()` | Get student archetype card weights | {cardWeights, isLoading} |
| `useOnboardingState()` | Get/set onboarding steps | {steps, overallStatus, updateStep, ...} |
| `useFileAttachment()` | Upload file, get attachment metadata | {upload, metadata, isUploading, error} |
| `useProviderAuth()` | Start/retry/disconnect provider | {status, authState, startAuth, ...} |

## RPC Subscription Channels

| Channel | Published By | Listener | Use |
|---------|--------------|----------|-----|
| `orchestration.domain` | OrchestrationService | useRuntimeOrchestrationSnapshot | Thread/turn updates |
| `provider.runtime` | CodexCli/TurnEventBus | Chat components | Token streaming, approvals |
| `canvas.syncProgress` | CanvasSyncService | useDashboard | Sync status |
| `dashboard.update` | PushBus | Dashboard page | Grade/assignment changes |
| `activity.feed` | ActivityFeed service | AnnouncementsFeed | Activity notifications |
| `memory.updated` | MemorizeService | Dashboard | Weekly recap generated |

## Key Dependencies

- **React 18** + **TanStack Router** (routing)
- **TanStack Query** (server state)
- **Zustand** (client state)
- **Tailwind CSS** (styling)
- **Sonner** (toast notifications)
- **Recharts** (grade charts)
- **Effect.js** (shared with server for type safety)

## API Surface for Components

All components consume through:
1. **RPC hooks** (`useOrchestrationActions`, `useChat`) → wsRpcClient calls
2. **Query hooks** (TanStack) → caching layer
3. **Zustand stores** → local state (filter selection, theme)
4. **Streaming subscriptions** (wsRpcClient.*.subscribe) → real-time updates
