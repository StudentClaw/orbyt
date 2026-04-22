export interface WalkthroughStep {
  readonly targetTestId: string
  readonly title: string
  readonly description: string
  readonly placement: "top" | "bottom" | "left" | "right"
}

export const DASHBOARD_WALKTHROUGH_STEPS: ReadonlyArray<WalkthroughStep> = [
  {
    targetTestId: "dashboard-filter-tabs",
    title: "Filters",
    description: "Switch between Today, This Week, Upcoming, and Overdue to focus your workload.",
    placement: "bottom",
  },
  {
    targetTestId: "dashboard-assignments",
    title: "Coursework",
    description: "Assignments grouped by course. Each block shows what’s due next for that class.",
    placement: "bottom",
  },
  {
    targetTestId: "grade-insights-widget",
    title: "Grade Insights",
    description: "Current standing by course, projected GPA, and whether grades are trending up or down.",
    placement: "bottom",
  },
  {
    targetTestId: "weekly-outlook-widget",
    title: "Weekly Outlook",
    description: "A compact timeline of study sessions and deadlines for the week.",
    placement: "bottom",
  },
  {
    targetTestId: "plan-my-week",
    title: "Plan my week",
    description: "Jump into chat with a pre-filled prompt to build a study plan with your assistant.",
    placement: "top",
  },
]
