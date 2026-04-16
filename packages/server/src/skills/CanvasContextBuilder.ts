import type { DatabaseService } from "../db/Database.js"

type CourseRow = {
  id: string
  name: string
  code: string
  professor: string | null
  term: string | null
}

type CourseworkRow = {
  id: string
  course_id: string
  title: string
  effective_due_at: string | null
  source_type: string
  points_possible: number | null
  submission_status: string | null
  grade: string | null
}

/**
 * Builds a plain-text Canvas context block from the local DB.
 * Includes all courses and assignments due within the next 14 days.
 * Injected into the turn content when a skill requests `context: canvas`.
 */
export function buildCanvasContext(database: DatabaseService, today: Date): string {
  const courses = database.query<CourseRow>(
    `SELECT id, name, code, professor, term FROM courses ORDER BY name ASC`,
  )

  if (courses.length === 0) {
    return `[Canvas Context]\nNo courses found. The student has not yet synced their Canvas account.\n`
  }

  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() + 14)
  const cutoffIso = cutoff.toISOString()

  const upcoming = database.query<CourseworkRow>(
    `SELECT cw.id, cw.course_id, cw.title, cw.effective_due_at,
            cw.source_type, cw.points_possible, cw.submission_status, cw.grade
     FROM coursework_items cw
     WHERE (cw.effective_due_at IS NULL OR cw.effective_due_at <= ?)
       AND cw.submission_status NOT IN ('graded', 'submitted')
     ORDER BY cw.effective_due_at ASC NULLS LAST`,
    [cutoffIso],
  )

  const courseMap = new Map(courses.map((c) => [c.id, c]))

  const lines: string[] = []
  lines.push(`[Canvas Context]`)
  lines.push(`Today: ${formatDate(today)}`)
  lines.push(``)

  lines.push(`Courses (${courses.length}):`)
  for (const c of courses) {
    const prof = c.professor ? ` — ${c.professor}` : ""
    const term = c.term ? ` [${c.term}]` : ""
    lines.push(`  • ${c.name} (${c.code})${prof}${term}`)
  }
  lines.push(``)

  const urgent = upcoming.filter((item) => {
    if (!item.effective_due_at) return false
    const due = new Date(item.effective_due_at)
    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
    return daysUntil <= 2
  })

  const rest = upcoming.filter((item) => {
    if (!item.effective_due_at) return true
    const due = new Date(item.effective_due_at)
    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
    return daysUntil > 2
  })

  if (urgent.length > 0) {
    lines.push(`URGENT — Due within 2 days:`)
    for (const item of urgent) {
      lines.push(`  ${formatItem(item, courseMap, today)}`)
    }
    lines.push(``)
  }

  lines.push(`Upcoming — Next 14 days (${rest.length} items):`)
  if (rest.length === 0) {
    lines.push(`  (none)`)
  } else {
    for (const item of rest) {
      lines.push(`  ${formatItem(item, courseMap, today)}`)
    }
  }
  lines.push(``)

  return lines.join("\n")
}

function formatItem(
  item: CourseworkRow,
  courseMap: Map<string, CourseRow>,
  today: Date,
): string {
  const course = courseMap.get(item.course_id)
  const courseLabel = course ? `[${course.code}]` : `[${item.course_id}]`
  const pts = item.points_possible != null ? ` — ${item.points_possible}pts` : ""
  const status = item.submission_status ? ` — ${item.submission_status}` : ""
  const graded = item.grade ? ` (grade: ${item.grade})` : ""
  const typeTag = item.source_type !== "assignment" ? ` (${item.source_type})` : ""

  let dueLabel = "no due date"
  if (item.effective_due_at) {
    const due = new Date(item.effective_due_at)
    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
    const dayWord = daysUntil === 1 ? "day" : "days"
    dueLabel = `due ${formatDate(due)} (${daysUntil} ${dayWord})`
  }

  return `${courseLabel} ${item.title}${typeTag} — ${dueLabel}${pts}${status}${graded}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
