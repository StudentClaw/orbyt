import type { CourseWorkItem, Grade } from "@student-claw/contracts"

export type GradeTrend = "up" | "stable" | "down"
export type UrgencyZone = "calm" | "attention" | "urgent" | "overdue"

/**
 * Weighted grade movement over the last 3-4 graded items for a course.
 * up (>+1%), stable (±1%), down (<-1%).
 */
export function computeGradeTrend(
  grades: ReadonlyArray<Grade>,
  courseId: string,
): GradeTrend {
  const courseGrades = grades
    .filter((g) => g.courseId === courseId && g.postedAt)
    .toSorted((a, b) => new Date(a.postedAt!).getTime() - new Date(b.postedAt!).getTime())

  if (courseGrades.length < 2) return "stable"

  const recent = courseGrades.slice(-4)
  if (recent.length < 2) return "stable"

  const firstHalf = recent.slice(0, Math.ceil(recent.length / 2))
  const secondHalf = recent.slice(Math.ceil(recent.length / 2))

  const avgFirst = weightedAverage(firstHalf)
  const avgSecond = weightedAverage(secondHalf)
  const movement = avgSecond - avgFirst

  if (movement > 1) return "up"
  if (movement < -1) return "down"
  return "stable"
}

function weightedAverage(grades: ReadonlyArray<Grade>): number {
  const totalScore = grades.reduce((sum, g) => sum + g.score, 0)
  const totalMax = grades.reduce((sum, g) => sum + g.maxScore, 0)
  return totalMax === 0 ? 0 : (totalScore / totalMax) * 100
}

/**
 * Weighted average score/maxScore for all grades in a course.
 */
export function computeCourseGradePercentage(
  grades: ReadonlyArray<Grade>,
  courseId: string,
): number {
  const courseGrades = grades.filter((g) => g.courseId === courseId)
  if (courseGrades.length === 0) return 0
  return weightedAverage(courseGrades)
}

/**
 * Urgency zone based on how far the due date is from now.
 * calm (7+ days), attention (3-6 days), urgent (1-2 days), overdue (past).
 */
export function computeUrgencyZone(
  item: CourseWorkItem,
  now: Date = new Date(),
): UrgencyZone {
  if (!item.effectiveDueAt) return "calm"

  const due = new Date(item.effectiveDueAt)
  const hoursRemaining = (due.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (hoursRemaining < 0) return "overdue"
  if (hoursRemaining < 48) return "urgent"
  if (hoursRemaining < 168) return "attention"
  return "calm"
}

/**
 * Human-readable countdown: "3 days", "12 hours", "Overdue".
 */
export function formatCountdown(dueDate: string, now: Date = new Date()): string {
  const due = new Date(dueDate)
  const diffMs = due.getTime() - now.getTime()

  if (diffMs < 0) return "Overdue"

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 24) {
    return hours === 1 ? "1 hour" : `${hours} hours`
  }

  const days = Math.floor(hours / 24)
  return days === 1 ? "1 day" : `${days} days`
}

/**
 * Groups coursework items by their due date (YYYY-MM-DD string),
 * filtered to items within the given window of days from now.
 */
export function groupDeadlinesByDay(
  items: ReadonlyArray<CourseWorkItem>,
  windowDays: number,
  now: Date = new Date(),
): Map<string, ReadonlyArray<CourseWorkItem>> {
  const cutoff = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000)
  const result = new Map<string, CourseWorkItem[]>()

  for (const item of items) {
    if (!item.effectiveDueAt) continue
    const due = new Date(item.effectiveDueAt)
    if (due < now || due > cutoff) continue

    const dayKey = due.toISOString().split("T")[0]
    const existing = result.get(dayKey) ?? []
    result.set(dayKey, [...existing, item])
  }

  return result
}

/**
 * Maps an urgency zone to a Tailwind-compatible color token.
 */
export function urgencyZoneColor(zone: UrgencyZone): string {
  switch (zone) {
    case "calm":
      return "text-green-500"
    case "attention":
      return "text-yellow-500"
    case "urgent":
      return "text-orange-500"
    case "overdue":
      return "text-red-500"
  }
}

/**
 * Maps an urgency zone to a background color token for badges.
 */
export function urgencyZoneBgColor(zone: UrgencyZone): string {
  switch (zone) {
    case "calm":
      return "bg-green-500/10 text-green-500"
    case "attention":
      return "bg-yellow-500/10 text-yellow-500"
    case "urgent":
      return "bg-orange-500/10 text-orange-500"
    case "overdue":
      return "bg-red-500/10 text-red-500"
  }
}
