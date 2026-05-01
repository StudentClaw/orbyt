export type TourPlacement = "top" | "bottom" | "left" | "right"
export type TourRoute = "/" | "/chat" | "/activity" | "/plugins"

interface TourSpotlightStep {
  readonly kind: "spotlight"
  readonly id: string
  readonly route: TourRoute
  readonly targetTestId: string
  readonly title: string
  readonly description: string
  readonly placement: TourPlacement
}

interface TourChapterStep {
  readonly kind: "chapter"
  readonly id: string
  readonly route: TourRoute
  readonly title: string
  readonly subtitle: string
  readonly finale?: boolean
}

export type TourStep = TourSpotlightStep | TourChapterStep

export const DASHBOARD_TOUR_STEPS: ReadonlyArray<TourStep> = [
  {
    kind: "chapter",
    id: "intro",
    route: "/",
    title: "Welcome aboard.",
    subtitle: "Let me show you around your new home.",
  },
  {
    kind: "spotlight",
    id: "folders-intro",
    route: "/chat",
    targetTestId: "chat-folders-group",
    title: "Work right inside a folder.",
    description: "Each folder is a sandbox — your syllabi, files, and chat history stay scoped to it. I only pull from what's in this folder.",
    placement: "right",
  },
  {
    kind: "spotlight",
    id: "folder-create",
    route: "/chat",
    targetTestId: "chat-add-folder",
    title: "Add a folder to begin.",
    description: "Before your first chat, drop a course folder in here. I'll read whatever you put inside, so the answers you get back are course-specific.",
    placement: "right",
  },
  {
    kind: "spotlight",
    id: "dashboard-plan",
    route: "/",
    targetTestId: "plan-my-week",
    title: "Plan your whole week in one click.",
    description: "I sweep your deadlines, your study hours, and free slots — and propose a study plan. You always say yes or shuffle it.",
    placement: "left",
  },
  {
    kind: "spotlight",
    id: "dashboard-tabs",
    route: "/",
    targetTestId: "dashboard-filter-tabs",
    title: "Slice by what's urgent.",
    description: "Today, This Week, Upcoming, Overdue, Submitted. Most days you live in \"This Week.\" I won't hide overdue assignments, you can check them out.",
    placement: "bottom",
  },
  {
    kind: "spotlight",
    id: "dashboard-card",
    route: "/",
    targetTestId: "dashboard-assignments",
    title: "Every card is real.",
    description: "Pulled live from Canvas. Click any one for the prompt, rubric, and a draft outline I'll prepare for you.",
    placement: "top",
  },
  {
    kind: "spotlight",
    id: "activity-proactive",
    route: "/activity",
    targetTestId: "sidebar-activity-link",
    title: "I'll nudge you — twice a day.",
    description: "A morning kickoff with what matters today, and an evening recap of what you closed. Plus I'll text you the moment Canvas drops something new.",
    placement: "right",
  },
  {
    kind: "spotlight",
    id: "plugins",
    route: "/plugins",
    targetTestId: "settings-plugin-first-row",
    title: "Connect more of your world.",
    description: "Canvas is on by default. Toggle on more plugins here — anything you connect folds into the same scope.",
    placement: "bottom",
  },
  {
    kind: "chapter",
    id: "handoff",
    route: "/",
    title: "You're all set.",
    subtitle: "Where do you want to start?",
    finale: true,
  },
] as const

export interface WalkthroughStep {
  readonly targetTestId: string
  readonly title: string
  readonly description: string
  readonly placement: TourPlacement
}
