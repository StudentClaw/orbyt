# Architecture Layer: React UI (Tier 2a)

## What It Is

The React UI is the frontend layer — everything the student sees and interacts with. It runs inside Electron's BrowserWindow (Chromium), built with Vite, and communicates through two typed channels: WebSocket (domain/chat streams) and preload IPC (desktop-native capabilities). It never makes network requests directly and never accesses the filesystem directly. It's a presentation and interaction layer with no direct external I/O.

---

## Technology Choices

### React + Vite

- **React**: Component-based UI, massive ecosystem, excellent for complex interactive apps
- **Vite**: Fast builds, HMR in development, optimized production bundles
- **TypeScript**: End-to-end type safety with Shared Contracts

### shadcn AI Chatbot Components

The Chat Interface leverages [shadcn.io/ai](https://www.shadcn.io/ai/chatbot) — a set of production-ready React components specifically built for AI chat experiences:

| Component | Student Claw Use |
|---|---|
| **Conversation** | Chat container with auto-scroll and scroll-to-bottom |
| **Message** | User/assistant message bubbles with markdown rendering |
| **Prompt Input** | Input bar with file attachments, voice, and web search toggles |
| **Reasoning** | Collapsible "thinking" blocks showing AI's reasoning process |
| **Sources** | Citation links when the AI references Canvas data or files |
| **Model Selector** | (Adapted) Skill selector — switch active skills from the chat |

These components are unstyled/customizable, so they'll be themed to match Student Claw's design system.

### State Management

The UI needs to manage:
- WebSocket connection state and reconnection
- Streaming message assembly (tokens arriving one by one)
- Dashboard data (courses, assignments, grades)
- Chat history
- Onboarding progress
- Active skills and extensions

**Candidates**: Zustand (lightweight, simple), Jotai (atomic), or a custom Effect-TS reactive store.

---

## Communication: Typed WebSocket + IPC

The React UI receives domain state and streaming events from the Local Server and uses preload IPC for desktop shell operations. It does not:
- Call Canvas APIs directly (security: no network from renderer)
- Read/write the filesystem (memory files, skills, etc. go through the server)
- Spawn processes (plugins are managed by Electron Main)

This boundary keeps the UI thin, testable, and secure while still supporting desktop-native workflows like file dialogs and notification click handling.

**WebSocket hook:**
```typescript
// Conceptual
const { send, subscribe, connectionState } = useWebSocket();

// Send a message
send({ method: "chat.sendMessage", params: { text: userInput } });

// Subscribe to streaming
subscribe("chat.streaming", (chunk) => appendToMessage(chunk));
```

**IPC examples (preload API):**
```typescript
window.electronAPI.invoke("file:open-dialog", { allowMultiple: false });
window.electronAPI.on("plugin:lifecycle", (evt) => updatePluginStatus(evt));
```

---

## UI Sections

Each section maps to a feature branch:

| Section | Feature | Route | Key Components |
|---|---|---|---|
| **Chat** | AI Harness | `/chat` | ChatContainer, MessageBubble, PromptInput, StreamingResponse |
| **Dashboard** | Dashboard | `/` (home) | PriorityQueue, GradeChart, DeadlineTimeline, WeeklyProgress, InsightCards, CompletionCheckin |
| **Calendar** | Smart Planner | `/calendar` | CalendarView, WeeklyCalendar, StudyBlockEditor, PlanModeOverlay |
| **Files** | File System | `/files` | FileExplorer, MarkdownViewer, PdfViewer |
| **Extensions** | Plugin System | `/extensions` | ExtensionManager, PluginCard, PermissionModal |
| **Settings** | Various | `/settings` | PreferenceEditor, AccountSettings, MemoryManager, NotificationSettings |
| **Onboarding** | Onboarding | `/onboarding` | OnboardingWizard (step-by-step flow with routines + plan demo) |

---

## Design System

Student Claw needs a cohesive visual language across all sections.

**Design principles:**
- **Academic, not corporate**: Warm and approachable, not cold SaaS
- **Calm by default, urgent when needed**: Muted palette that shifts to attention colors near deadlines
- **Information-dense but readable**: Students need to see a lot at once without feeling overwhelmed
- **Dark mode first**: Most students prefer dark mode for late-night study sessions
- **Responsive within the window**: Electron windows can be resized; layout should adapt gracefully

**Component library foundation:**
- Base: Tailwind CSS for utility classes
- Components: shadcn/ui for base primitives (Button, Card, Dialog, etc.)
- AI components: shadcn.io/ai for chat-specific components
- Charts: Recharts or similar for grade visualization
- Icons: Lucide (default with shadcn)

---

## Proposed File Structure

```
packages/ui/
  package.json
  vite.config.ts
  tsconfig.json
  tailwind.config.ts
  src/
    main.tsx                            # App entry, router setup
    App.tsx                             # Root layout with navigation
    components/
      chat/                             # → see 01-ai-harness.md
        ChatContainer.tsx
        MessageBubble.tsx
        PromptInput.tsx
        StreamingResponse.tsx
        ReasoningBlock.tsx
        SourceCitations.tsx
        SkillSelector.tsx
      dashboard/                        # → see 06-dashboard.md
        DashboardLayout.tsx
        PriorityQueue.tsx
        GradeOverview.tsx
        GradeChart.tsx
        DeadlineTimeline.tsx
        WeeklyCalendar.tsx              # Study session calendar from Smart Planner
        CompletionCheckin.tsx           # Yes / No / Yes-but three-way prompt
        WeeklyProgress.tsx
        InsightCards.tsx                # AI-generated proactive insight cards
        AnnouncementsFeed.tsx
        QuickActions.tsx
      onboarding/                       # → see 08-onboarding.md
        OnboardingWizard.tsx
        InstitutionSelector.tsx         # Searchable university list
        CanvasCredentialStep.tsx
        AiAuthStep.tsx
        PreferencesStep.tsx
        RoutinesStep.tsx                # Weekly recurring blocks input
        FirstSyncStep.tsx
        DashboardWalkthrough.tsx
      calendar/                         # → see 09-smart-planner.md
        CalendarView.tsx
        WeeklyCalendar.tsx
        PlanModeOverlay.tsx
        StudyBlockEditor.tsx
      notifications/                    # → see 10-notification-service.md
        NotificationSettings.tsx        # Per-type notification preferences
        ActivityCenter.tsx              # Unified feed: Canvas, Planner, Agent Activity, Insights
      files/                            # → see 07-file-system.md
        FileExplorer.tsx
        MarkdownViewer.tsx
        PdfViewer.tsx
        FileDropZone.tsx
      extensions/                       # → see 05-plugin-system.md
        ExtensionManager.tsx
        PluginCard.tsx
        PermissionModal.tsx
      settings/
        PreferenceEditor.tsx
        AccountSettings.tsx
        MemoryManager.tsx
      shared/
        Navigation.tsx
        LoadingState.tsx
        ErrorBoundary.tsx
        NotificationBanner.tsx
    hooks/
      useWebSocket.ts                   # WS connection, reconnect, message routing
      useStreaming.ts                    # Assemble streaming tokens into messages
      useCanvas.ts                      # Canvas data subscriptions
      useMemory.ts                      # Memory system queries
      useDashboard.ts                   # Dashboard data aggregation
      usePlanner.ts                     # Smart Planner sessions and completion
      useNotifications.ts               # Notification subscriptions and settings
    stores/
      chatStore.ts                      # Chat history, active conversation
      canvasStore.ts                    # Courses, assignments, grades
      dashboardStore.ts                 # Dashboard state
      plannerStore.ts                   # Planned sessions, tasks, calendar state
      notificationStore.ts              # Notification queue and preferences
      settingsStore.ts                  # User preferences
      onboardingStore.ts                # Onboarding progress
    lib/
      ws-client.ts                      # Low-level WebSocket client
      schema-validator.ts               # Validate messages against Shared Contracts
```

---

## Open Questions

- **State management**: Zustand vs. Jotai vs. something else? Need to handle WebSocket events, streaming state, and cached data.
- **Routing**: React Router vs. TanStack Router? The app has relatively simple routing needs.
- **Offline UI**: What does the UI show when the server is unreachable? Cached data? A reconnecting indicator?
- **Accessibility**: Full WCAG 2.1 AA compliance? Keyboard navigation, screen reader support, focus management.
- **Animations**: Should transitions between sections be animated? Skeleton loading states?
- **Theming**: Just dark/light, or should students be able to customize accent colors?
