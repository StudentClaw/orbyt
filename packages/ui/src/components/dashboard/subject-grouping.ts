import type { Course } from "@student-claw/contracts"
import { sortByPriority, type PrioritizedItem } from "./priority-model"

export type FilterScope = "today" | "thisWeek" | "upcoming" | "overdue"

/** Local calendar date `YYYY-MM-DD`. */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function startOfWeekMonday(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfWeekSunday(monday: Date): Date {
  const d = new Date(monday)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Mutually exclusive scopes for filter tabs:
 * - overdue: due before now
 * - today: due later today (same local calendar day, not overdue)
 * - thisWeek: due Mon–Sun of current week, excluding "today" bucket
 * - upcoming: everything else with a future due date
 */
export function classifyAssignmentScope(item: PrioritizedItem, now: Date): FilterScope {
  const due = new Date(item.effectiveDueAt)
  if (due.getTime() < now.getTime()) return "overdue"

  if (localDateKey(due) === localDateKey(now)) return "today"

  const monday = startOfWeekMonday(now)
  const sunday = endOfWeekSunday(monday)
  if (due.getTime() >= monday.getTime() && due.getTime() <= sunday.getTime()) {
    return "thisWeek"
  }
  return "upcoming"
}

export function filterItemsByScope(
  items: ReadonlyArray<PrioritizedItem>,
  filter: FilterScope,
  now: Date,
): ReadonlyArray<PrioritizedItem> {
  return items.filter((item) => classifyAssignmentScope(item, now) === filter)
}

export interface CourseWithWork {
  readonly course: Course
  readonly items: ReadonlyArray<PrioritizedItem>
}

/**
 * Filter by tab, sort globally by priority, then group remaining items by course
 * in the order of `courses`.
 */
export function groupAssignmentsByCourse(
  courses: ReadonlyArray<Course>,
  items: ReadonlyArray<PrioritizedItem>,
  filter: FilterScope,
  now: Date,
): ReadonlyArray<CourseWithWork> {
  const filtered = filterItemsByScope(items, filter, now)
  const sorted = sortByPriority(filtered, now)
  const byCourse = new Map<string, PrioritizedItem[]>()
  for (const item of sorted) {
    const list = byCourse.get(item.courseId) ?? []
    list.push(item)
    byCourse.set(item.courseId, list)
  }
  return courses
    .map((course) => ({
      course,
      items: byCourse.get(course.id) ?? [],
    }))
    .filter((g) => g.items.length > 0)
}

/** Non-overdue items with due datetime falling in the current local Mon–Sun window. */
export function countDueThisWeek(items: ReadonlyArray<PrioritizedItem>, now: Date): number {
  const monday = startOfWeekMonday(now)
  const sunday = endOfWeekSunday(monday)
  return items.filter((item) => {
    const due = new Date(item.effectiveDueAt)
    if (due.getTime() < now.getTime()) return false
    return due.getTime() >= monday.getTime() && due.getTime() <= sunday.getTime()
  }).length
}
