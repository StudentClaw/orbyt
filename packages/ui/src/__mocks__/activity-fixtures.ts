import type { ActivityFeedEntry } from "@student-claw/contracts"

export const MOCK_ACTIVITY_ENTRIES: ReadonlyArray<ActivityFeedEntry> = [
  {
    id: "a1" as any,
    category: "canvas",
    type: "grade_posted",
    title: "Grade posted for HW3",
    body: "You received 92/100 on Homework 3 in CS 101",
    priority: 2,
    deepLink: "/",
  },
  {
    id: "a2" as any,
    category: "planner",
    type: "session_reminder",
    title: "Study session starting soon",
    body: "Your CS 101 study session starts in 15 minutes",
    priority: 3,
  },
  {
    id: "a3" as any,
    category: "canvas",
    type: "assignment_added",
    title: "New assignment: Problem Set 4",
    body: "Due April 18 in MATH 240",
    priority: 2,
    deepLink: "/",
  },
  {
    id: "a4" as any,
    category: "insight",
    type: "weekly_insight",
    title: "Weekly insight",
    body: "You completed 80% of planned sessions this week",
    priority: 1,
  },
  {
    id: "a5" as any,
    category: "workflow",
    type: "plan_generated",
    title: "Plan generated for next week",
    body: "12 study sessions scheduled",
    priority: 1,
  },
]
