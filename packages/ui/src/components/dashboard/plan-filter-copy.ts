import type { FilterScope } from "./subject-grouping"

interface PlanFilterCopy {
  readonly planLabel: string
  readonly promptIntro: string
  readonly assignmentsHeading: string
  readonly emptyAssignments: string
}

const PLAN_FILTER_COPY: Record<FilterScope, PlanFilterCopy> = {
  today: {
    planLabel: "Plan my day",
    promptIntro:
      "Plan my day using my current calendar availability and the coursework matching the dashboard's Today filter.",
    assignmentsHeading: "Assignments in the dashboard's Today filter:",
    emptyAssignments: "No dashboard assignments match the Today filter.",
  },
  thisWeek: {
    planLabel: "Plan my week",
    promptIntro:
      "Plan my week using my current calendar availability and the coursework matching the dashboard's This Week filter.",
    assignmentsHeading: "Assignments in the dashboard's This Week filter:",
    emptyAssignments: "No dashboard assignments match the This Week filter.",
  },
  upcoming: {
    planLabel: "Plan my upcoming work",
    promptIntro:
      "Plan my upcoming work using my current calendar availability and the coursework matching the dashboard's Upcoming filter.",
    assignmentsHeading: "Assignments in the dashboard's Upcoming filter:",
    emptyAssignments: "No dashboard assignments match the Upcoming filter.",
  },
  overdue: {
    planLabel: "Plan my overdue work",
    promptIntro:
      "Plan my overdue work using my current calendar availability and the coursework matching the dashboard's Overdue filter.",
    assignmentsHeading: "Assignments in the dashboard's Overdue filter:",
    emptyAssignments: "No dashboard assignments match the Overdue filter.",
  },
  submitted: {
    planLabel: "Plan my submitted work",
    promptIntro:
      "Plan my submitted work using my current calendar availability and the coursework matching the dashboard's Submitted filter.",
    assignmentsHeading: "Assignments in the dashboard's Submitted filter:",
    emptyAssignments: "No dashboard assignments match the Submitted filter.",
  },
}

export function getPlanFilterCopy(filter: FilterScope): PlanFilterCopy {
  return PLAN_FILTER_COPY[filter]
}
