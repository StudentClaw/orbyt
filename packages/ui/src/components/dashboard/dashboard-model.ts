import type { CanvasStudentCourseGradeSummary, CourseWorkItem } from "@student-claw/contracts"

export type GradeTrend = "up" | "stable" | "down"
export type UrgencyZone = "calm" | "attention" | "urgent" | "overdue"

/**
 * Weighted grade movement over the last 3-4 graded items for a course.
 * up (>+1%), stable (±1%), down (<-1%).
 */
export function computeGradeTrend(
  grades: ReadonlyArray<CanvasStudentCourseGradeSummary>,
  courseId: string,
): GradeTrend {
  const summary = grades.find((grade) => grade.course.id === courseId)
  if (!summary) return "stable"

  const baseline = summary.currentScore
  const comparison = summary.finalScore
  if (baseline === undefined || comparison === undefined) return "stable"

  const movement = comparison - baseline

  if (movement > 1) return "up"
  if (movement < -1) return "down"
  return "stable"
}

/**
 * Weighted average score/maxScore for all grades in a course.
 */
export function computeCourseGradePercentage(
  grades: ReadonlyArray<CanvasStudentCourseGradeSummary>,
  courseId: string,
): number {
  const summary = grades.find((grade) => grade.course.id === courseId)
  if (!summary) return 0
  return summary.currentScore ?? summary.finalScore ?? 0
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
