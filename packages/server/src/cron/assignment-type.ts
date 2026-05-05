import type { DatabaseService } from "../db/Database.js"

export const ASSIGNMENT_TYPES = ["assessment", "work", "passive"] as const
export type AssignmentType = typeof ASSIGNMENT_TYPES[number]

// "final" alone is ambiguous (final project, final paper). Require it to be
// followed by an assessment word, or matched as the plural "finals".
const ASSESSMENT_PATTERN =
  /\b(?:quiz(?:zes)?|exam(?:s)?|midterm(?:s)?|finals|test(?:s)?|practical|orals?)\b|\bfinal\s+(?:exam|test|quiz|review)\b/i

const WORK_PATTERN =
  /\b(lab(?:s|\s?report)?|homework|hw|assignment(?:s)?|problem\s?set(?:s)?|p[\-\s]?set(?:s)?|project(?:s)?|report(?:s)?|paper(?:s)?|essay(?:s)?|writeup(?:s)?|deliverable(?:s)?|submission(?:s)?)\b/i

const PASSIVE_PATTERN =
  /\b(pre[\s\-]?read(?:ing)?|reading|read|discussion|forum|reflection|response|post|comment)\b/i

/**
 * Classify a Canvas assignment by its title alone, using a wide regex set.
 * Order: assessment → work → passive → default 'work'. Returns null only if
 * the caller wants to know the regex didn't fire (use `classifyOrNull`).
 */
export function classifyAssignmentByTitle(title: string): AssignmentType {
  const t = (title ?? "").trim()
  if (t.length === 0) return "work"
  if (ASSESSMENT_PATTERN.test(t)) return "assessment"
  if (WORK_PATTERN.test(t)) return "work"
  if (PASSIVE_PATTERN.test(t)) return "passive"
  return "work"
}

/** Returns null when no regex pattern matched, signalling LLM fallback is appropriate. */
export function classifyOrNull(title: string): AssignmentType | null {
  const t = (title ?? "").trim()
  if (t.length === 0) return null
  if (ASSESSMENT_PATTERN.test(t)) return "assessment"
  if (WORK_PATTERN.test(t)) return "work"
  if (PASSIVE_PATTERN.test(t)) return "passive"
  return null
}

interface CourseworkAssignmentTypeRow {
  id: string
  title: string | null
  assignment_type: string | null
}

/**
 * Reads (or computes + caches) the assignment_type for the given coursework ids.
 *
 * Strategy per spec: regex first (deterministic, free); LLM fallback intentionally
 * left as a hook so the wide regex carries the load. If a row already has a
 * non-null assignment_type we trust the cache.
 */
export function ensureAssignmentTypes(
  database: DatabaseService,
  ids: ReadonlyArray<string>,
): Map<string, AssignmentType> {
  const result = new Map<string, AssignmentType>()
  if (ids.length === 0) return result

  const placeholders = ids.map(() => "?").join(",")
  const rows = database.query<CourseworkAssignmentTypeRow>(
    `SELECT id, title, assignment_type FROM coursework_items WHERE id IN (${placeholders})`,
    [...ids],
  )

  for (const row of rows) {
    const cached = row.assignment_type
    if (cached === "assessment" || cached === "work" || cached === "passive") {
      result.set(row.id, cached)
      continue
    }
    const classified = classifyAssignmentByTitle(row.title ?? "")
    result.set(row.id, classified)
    try {
      database.execute(
        `UPDATE coursework_items SET assignment_type = ? WHERE id = ?`,
        [classified, row.id],
      )
    } catch {
      // Non-fatal — a missing column or write conflict shouldn't break the run.
    }
  }

  return result
}
