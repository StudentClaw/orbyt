export interface WalkthroughStep {
  readonly targetTestId: string
  readonly title: string
  readonly description: string
  readonly placement: "top" | "bottom" | "left" | "right"
}

export const DASHBOARD_WALKTHROUGH_STEPS: ReadonlyArray<WalkthroughStep> = [
  {
    targetTestId: "section-priorityQueue",
    title: "Priority Queue",
    description: "Your most urgent tasks, ranked by deadline and importance.",
    placement: "bottom",
  },
  {
    targetTestId: "section-deadlines",
    title: "Upcoming Deadlines",
    description: "All your assignments organized by due date for the next 14 days.",
    placement: "bottom",
  },
  {
    targetTestId: "section-grades",
    title: "Grade Overview",
    description: "Track your grades across all courses with trend indicators.",
    placement: "bottom",
  },
  {
    targetTestId: "section-calendar",
    title: "Weekly Calendar",
    description: "Your study sessions planned for the week, color-coded by course.",
    placement: "bottom",
  },
  {
    targetTestId: "quick-actions",
    title: "Quick Actions",
    description: "Start a conversation with your AI study assistant from here.",
    placement: "top",
  },
]
