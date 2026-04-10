import type {
  Course,
  CourseWorkItem,
  Grade,
  PlannedSession,
  ActivityFeedEntry,
} from "@student-claw/contracts"

// --- Helper factories ---

function courseId(n: number): string {
  return `course-${n}` as string & { readonly CourseId: unique symbol }
}

function itemId(n: number): string {
  return `item-${n}` as string & { readonly CourseWorkItemId: unique symbol }
}

function sessionId(n: number): string {
  return `session-${n}` as string & { readonly SessionId: unique symbol }
}

function taskId(n: number): string {
  return `task-${n}` as string & { readonly TaskId: unique symbol }
}

function activityId(n: number): string {
  return `activity-${n}` as string & { readonly ActivityEntryId: unique symbol }
}

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function todayAt(hour: number, minute = 0): string {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

// --- Mock Courses ---

export const MOCK_COURSES: ReadonlyArray<Course> = [
  {
    id: courseId(1) as any,
    name: "Introduction to Computer Science",
    code: "CS 101",
    professor: "Dr. Martinez",
    canvasId: "canvas-cs101",
    term: "Spring 2026",
    lastSyncAt: daysAgo(0),
  },
  {
    id: courseId(2) as any,
    name: "Organic Chemistry II",
    code: "CHEM 202",
    professor: "Dr. Patel",
    canvasId: "canvas-chem202",
    term: "Spring 2026",
    lastSyncAt: daysAgo(0),
  },
  {
    id: courseId(3) as any,
    name: "American Literature Since 1865",
    code: "ENGL 310",
    professor: "Prof. Johnson",
    canvasId: "canvas-engl310",
    term: "Spring 2026",
    lastSyncAt: daysAgo(0),
  },
  {
    id: courseId(4) as any,
    name: "Linear Algebra",
    code: "MATH 240",
    professor: "Dr. Chen",
    canvasId: "canvas-math240",
    term: "Spring 2026",
    lastSyncAt: daysAgo(0),
  },
  {
    id: courseId(5) as any,
    name: "Introduction to Psychology",
    code: "PSYCH 100",
    professor: "Dr. Williams",
    canvasId: "canvas-psych100",
    term: "Spring 2026",
    lastSyncAt: daysAgo(1),
  },
]

// --- Mock Coursework Items ---

export const MOCK_COURSEWORK_ITEMS: ReadonlyArray<CourseWorkItem> = [
  {
    id: itemId(1) as any,
    courseId: courseId(1) as any,
    title: "Problem Set 5: Recursion",
    effectiveDueAt: daysFromNow(2),
    sourceType: "assignment",
    freshnessStatus: "fresh",
    pointsPossible: 100,
    submissionStatus: "not_submitted",
  },
  {
    id: itemId(2) as any,
    courseId: courseId(2) as any,
    title: "Lab Report: Synthesis of Aspirin",
    effectiveDueAt: daysFromNow(1),
    sourceType: "assignment",
    freshnessStatus: "fresh",
    pointsPossible: 50,
    submissionStatus: "not_submitted",
  },
  {
    id: itemId(3) as any,
    courseId: courseId(3) as any,
    title: "Essay: Themes in The Great Gatsby",
    effectiveDueAt: daysFromNow(5),
    sourceType: "assignment",
    freshnessStatus: "fresh",
    pointsPossible: 200,
    submissionStatus: "not_submitted",
  },
  {
    id: itemId(4) as any,
    courseId: courseId(4) as any,
    title: "Homework 7: Eigenvalues",
    effectiveDueAt: daysFromNow(3),
    sourceType: "assignment",
    freshnessStatus: "fresh",
    pointsPossible: 80,
    submissionStatus: "not_submitted",
  },
  {
    id: itemId(5) as any,
    courseId: courseId(1) as any,
    title: "Midterm Exam Review",
    effectiveDueAt: daysFromNow(7),
    sourceType: "assignment",
    freshnessStatus: "fresh",
    pointsPossible: 300,
    submissionStatus: "not_submitted",
  },
  {
    id: itemId(6) as any,
    courseId: courseId(5) as any,
    title: "Chapter 8 Reading Response",
    effectiveDueAt: daysFromNow(4),
    sourceType: "assignment",
    freshnessStatus: "fresh",
    pointsPossible: 20,
    submissionStatus: "not_submitted",
  },
  {
    id: itemId(7) as any,
    courseId: courseId(2) as any,
    title: "Pre-lab Quiz: Distillation",
    effectiveDueAt: daysFromNow(1),
    sourceType: "assignment",
    freshnessStatus: "fresh",
    pointsPossible: 10,
    submissionStatus: "not_submitted",
  },
  {
    id: itemId(8) as any,
    courseId: courseId(3) as any,
    title: "Discussion Board Post: Week 10",
    effectiveDueAt: daysFromNow(6),
    sourceType: "assignment",
    freshnessStatus: "fresh",
    pointsPossible: 15,
    submissionStatus: "not_submitted",
  },
  {
    id: itemId(9) as any,
    courseId: courseId(4) as any,
    title: "Quiz 4: Vector Spaces",
    effectiveDueAt: daysFromNow(2),
    sourceType: "assignment",
    freshnessStatus: "fresh",
    pointsPossible: 50,
    submissionStatus: "not_submitted",
  },
  {
    id: itemId(10) as any,
    courseId: courseId(1) as any,
    title: "Lab 6: Binary Trees",
    effectiveDueAt: daysFromNow(8),
    sourceType: "assignment",
    freshnessStatus: "fresh",
    pointsPossible: 60,
    submissionStatus: "not_submitted",
  },
  {
    id: itemId(11) as any,
    courseId: courseId(5) as any,
    title: "Midterm Exam",
    effectiveDueAt: daysFromNow(10),
    sourceType: "assignment",
    freshnessStatus: "fresh",
    pointsPossible: 150,
    submissionStatus: "not_submitted",
  },
  {
    id: itemId(12) as any,
    courseId: courseId(2) as any,
    title: "Problem Set 6: Reaction Mechanisms",
    effectiveDueAt: daysFromNow(9),
    sourceType: "assignment",
    freshnessStatus: "stale",
    pointsPossible: 75,
    submissionStatus: "not_submitted",
  },
  {
    id: itemId(13) as any,
    courseId: courseId(4) as any,
    title: "Final Project Proposal",
    effectiveDueAt: daysFromNow(12),
    sourceType: "assignment",
    freshnessStatus: "fresh",
    pointsPossible: 100,
    submissionStatus: "not_submitted",
  },
  {
    id: itemId(14) as any,
    courseId: courseId(3) as any,
    title: "Peer Review: Draft 1",
    effectiveDueAt: daysFromNow(4),
    sourceType: "assignment",
    freshnessStatus: "fresh",
    pointsPossible: 30,
    submissionStatus: "not_submitted",
  },
  {
    id: itemId(15) as any,
    courseId: courseId(1) as any,
    title: "Reading: Chapter 12",
    effectiveDueAt: daysFromNow(1),
    sourceType: "page",
    freshnessStatus: "fresh",
    pointsPossible: 10,
    submissionStatus: "not_submitted",
  },
]

// --- Mock Grades ---

export const MOCK_GRADES: ReadonlyArray<Grade> = [
  // CS 101 grades — trending up
  { courseId: courseId(1) as any, assignmentId: "a1", score: 82, maxScore: 100, letterGrade: "B-", postedAt: daysAgo(28) },
  { courseId: courseId(1) as any, assignmentId: "a2", score: 88, maxScore: 100, letterGrade: "B+", postedAt: daysAgo(21) },
  { courseId: courseId(1) as any, assignmentId: "a3", score: 91, maxScore: 100, letterGrade: "A-", postedAt: daysAgo(14) },
  { courseId: courseId(1) as any, assignmentId: "a4", score: 95, maxScore: 100, letterGrade: "A", postedAt: daysAgo(7) },

  // CHEM 202 grades — trending down
  { courseId: courseId(2) as any, assignmentId: "a1", score: 45, maxScore: 50, letterGrade: "A", postedAt: daysAgo(28) },
  { courseId: courseId(2) as any, assignmentId: "a2", score: 42, maxScore: 50, letterGrade: "B+", postedAt: daysAgo(21) },
  { courseId: courseId(2) as any, assignmentId: "a3", score: 38, maxScore: 50, letterGrade: "B-", postedAt: daysAgo(14) },
  { courseId: courseId(2) as any, assignmentId: "a4", score: 35, maxScore: 50, letterGrade: "C+", postedAt: daysAgo(7) },

  // ENGL 310 grades — stable
  { courseId: courseId(3) as any, assignmentId: "a1", score: 170, maxScore: 200, letterGrade: "B+", postedAt: daysAgo(28) },
  { courseId: courseId(3) as any, assignmentId: "a2", score: 172, maxScore: 200, letterGrade: "B+", postedAt: daysAgo(21) },
  { courseId: courseId(3) as any, assignmentId: "a3", score: 168, maxScore: 200, letterGrade: "B+", postedAt: daysAgo(14) },
  { courseId: courseId(3) as any, assignmentId: "a4", score: 171, maxScore: 200, letterGrade: "B+", postedAt: daysAgo(7) },

  // MATH 240 grades — trending up
  { courseId: courseId(4) as any, assignmentId: "a1", score: 60, maxScore: 80, letterGrade: "B-", postedAt: daysAgo(28) },
  { courseId: courseId(4) as any, assignmentId: "a2", score: 68, maxScore: 80, letterGrade: "B+", postedAt: daysAgo(21) },
  { courseId: courseId(4) as any, assignmentId: "a3", score: 72, maxScore: 80, letterGrade: "A-", postedAt: daysAgo(14) },
  { courseId: courseId(4) as any, assignmentId: "a4", score: 76, maxScore: 80, letterGrade: "A", postedAt: daysAgo(7) },

  // PSYCH 100 grades — trending down
  { courseId: courseId(5) as any, assignmentId: "a1", score: 18, maxScore: 20, letterGrade: "A", postedAt: daysAgo(21) },
  { courseId: courseId(5) as any, assignmentId: "a2", score: 16, maxScore: 20, letterGrade: "B", postedAt: daysAgo(14) },
  { courseId: courseId(5) as any, assignmentId: "a3", score: 14, maxScore: 20, letterGrade: "C+", postedAt: daysAgo(7) },
]

// --- Mock Planned Sessions ---

export const MOCK_PLANNED_SESSIONS: ReadonlyArray<PlannedSession> = [
  {
    id: sessionId(1) as any,
    taskId: taskId(1) as any,
    courseId: courseId(1) as any,
    startTime: todayAt(9, 0),
    endTime: todayAt(10, 30),
    status: "scheduled",
    sessionLabel: "Problem Set 5 — Part 1",
    courseName: "CS 101",
    assignmentTitle: "Problem Set 5: Recursion",
  },
  {
    id: sessionId(2) as any,
    taskId: taskId(2) as any,
    courseId: courseId(2) as any,
    startTime: todayAt(11, 0),
    endTime: todayAt(12, 30),
    status: "scheduled",
    sessionLabel: "Lab Report — Draft",
    courseName: "CHEM 202",
    assignmentTitle: "Lab Report: Synthesis of Aspirin",
  },
  {
    id: sessionId(3) as any,
    taskId: taskId(3) as any,
    courseId: courseId(3) as any,
    startTime: todayAt(14, 0),
    endTime: todayAt(16, 0),
    status: "completed",
    sessionLabel: "Essay Outline",
    courseName: "ENGL 310",
    assignmentTitle: "Essay: Themes in The Great Gatsby",
  },
  {
    id: sessionId(4) as any,
    taskId: taskId(4) as any,
    courseId: courseId(4) as any,
    startTime: todayAt(16, 30),
    endTime: todayAt(18, 0),
    status: "scheduled",
    sessionLabel: "Eigenvalues Practice",
    courseName: "MATH 240",
    assignmentTitle: "Homework 7: Eigenvalues",
  },
  {
    id: sessionId(5) as any,
    taskId: taskId(1) as any,
    courseId: courseId(1) as any,
    startTime: todayAt(19, 0),
    endTime: todayAt(20, 0),
    status: "scheduled",
    sessionLabel: "Problem Set 5 — Part 2",
    courseName: "CS 101",
    assignmentTitle: "Problem Set 5: Recursion",
  },
]

// --- Mock Activity Feed ---

export const MOCK_ACTIVITY_FEED: ReadonlyArray<ActivityFeedEntry> = [
  {
    id: activityId(1) as any,
    category: "canvas",
    type: "grade_posted",
    title: "New grade: CS 101 — Problem Set 4",
    body: "You scored 95/100 (A)",
    priority: 2,
    deepLink: "/dashboard",
  },
  {
    id: activityId(2) as any,
    category: "planner",
    type: "session_reminder",
    title: "Study session starting soon",
    body: "Problem Set 5: Recursion — starts in 15 minutes",
    priority: 3,
  },
  {
    id: activityId(3) as any,
    category: "canvas",
    type: "assignment_added",
    title: "New assignment: CHEM 202",
    body: "Problem Set 6: Reaction Mechanisms — due in 9 days",
    priority: 2,
  },
  {
    id: activityId(4) as any,
    category: "insight",
    type: "weekly_insight",
    title: "Great week in CS 101!",
    body: "Your grades have been trending up — you've improved 13% this month.",
    priority: 1,
  },
  {
    id: activityId(5) as any,
    category: "canvas",
    type: "announcement_posted",
    title: "New announcement: ENGL 310",
    body: "Prof. Johnson posted about the essay rubric changes",
    priority: 2,
  },
]

// --- Mock Announcements ---

export interface AnnouncementData {
  readonly id: string
  readonly courseId: string
  readonly courseName: string
  readonly professor: string
  readonly title: string
  readonly body: string
  readonly postedAt: string
  readonly read: boolean
}

export const MOCK_ANNOUNCEMENTS: ReadonlyArray<AnnouncementData> = [
  {
    id: "ann-1",
    courseId: courseId(3),
    courseName: "ENGL 310",
    professor: "Prof. Johnson",
    title: "Essay Rubric Update",
    body: "I've updated the rubric for the Gatsby essay. Please review the new criteria before submitting. The main change is that the thesis statement is now worth 20% instead of 15%, and I've added a section on citation quality. Make sure to use at least 3 peer-reviewed sources.",
    postedAt: daysAgo(1),
    read: false,
  },
  {
    id: "ann-2",
    courseId: courseId(1),
    courseName: "CS 101",
    professor: "Dr. Martinez",
    title: "Office Hours Change This Week",
    body: "Due to the department meeting, my Thursday office hours are moved to Friday 2-4pm. The TA office hours remain unchanged.",
    postedAt: daysAgo(2),
    read: true,
  },
  {
    id: "ann-3",
    courseId: courseId(2),
    courseName: "CHEM 202",
    professor: "Dr. Patel",
    title: "Lab Safety Reminder",
    body: "Please remember to bring your safety goggles and lab coat to all sessions. Students without proper PPE will not be allowed to participate in the lab.",
    postedAt: daysAgo(3),
    read: true,
  },
  {
    id: "ann-4",
    courseId: courseId(4),
    courseName: "MATH 240",
    professor: "Dr. Chen",
    title: "Midterm Review Session",
    body: "I will be holding an extra review session on Saturday 10am-12pm in Room 204. We'll cover eigenvalues, vector spaces, and linear transformations. Bring your practice problems.",
    postedAt: daysAgo(0),
    read: false,
  },
  {
    id: "ann-5",
    courseId: courseId(5),
    courseName: "PSYCH 100",
    professor: "Dr. Williams",
    title: "Guest Lecture Next Week",
    body: "We'll have a guest speaker from the university counseling center discussing cognitive behavioral therapy applications. Attendance is mandatory and will count toward participation.",
    postedAt: daysAgo(4),
    read: true,
  },
]

// --- Mock Insights ---

export interface InsightData {
  readonly id: string
  readonly title: string
  readonly body: string
  readonly actionLabel?: string
  readonly actionContext?: string
}

export const MOCK_INSIGHTS: ReadonlyArray<InsightData> = [
  {
    id: "insight-1",
    title: "3 deadlines next week",
    body: "You have deadlines clustering around Thursday. Want to get ahead?",
    actionLabel: "Plan my week",
    actionContext: "plan my week",
  },
  {
    id: "insight-2",
    title: "CS 101 grades trending up",
    body: "You've improved 13% this month in CS 101. Keep it up!",
  },
  {
    id: "insight-3",
    title: "CHEM 202 needs attention",
    body: "Your chemistry grades have been declining. Consider scheduling extra study time.",
    actionLabel: "Help me study",
    actionContext: "help me study for CHEM 202",
  },
]
