import { createHash } from "node:crypto"
import type { Course, CourseWorkItem } from "@orbyt/contracts"

const MONTHS = new Map<string, number>([
  ["jan", 0],
  ["january", 0],
  ["feb", 1],
  ["february", 1],
  ["mar", 2],
  ["march", 2],
  ["apr", 3],
  ["april", 3],
  ["may", 4],
  ["jun", 5],
  ["june", 5],
  ["jul", 6],
  ["july", 6],
  ["aug", 7],
  ["august", 7],
  ["sep", 8],
  ["sept", 8],
  ["september", 8],
  ["oct", 9],
  ["october", 9],
  ["nov", 10],
  ["november", 10],
  ["dec", 11],
  ["december", 11],
])

const DATE_LINE_RE =
  /^(?:\(?\s*)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i
const READ_LINE_RE = /^read\s*:\s*(.+)$/i
const QUIZ_LINE_RE = /^(quiz\s*#?\d*.*)$/i

export interface DatedReadingScheduleInput {
  readonly body: string
  readonly course: Course
  readonly sourceId: string
  readonly sourceUrl: string
  readonly sourceUpdatedAt?: string
  readonly now?: Date
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
}

export function normalizeCanvasPageText(body: string): string {
  return decodeHtmlEntities(body)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
}

function inferYear(course: Course, now: Date): number {
  const fields = [course.term, course.name, course.code].filter(Boolean).join(" ")
  const match = fields.match(/\b(20\d{2})\b/)
  return match ? Number.parseInt(match[1]!, 10) : now.getFullYear()
}

function dueAtIso(year: number, monthIndex: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex, day, 23, 59, 0, 0)).toISOString()
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "item"
}

function stableItemId(input: {
  readonly courseId: string
  readonly sourceId: string
  readonly dueDate: string
  readonly title: string
}): string {
  const slug = slugify(input.title)
  const hash = createHash("sha1")
    .update(`${input.courseId}:${input.sourceId}:${input.dueDate}:${input.title}`)
    .digest("hex")
    .slice(0, 10)
  return `canvas-coursework:page:${input.courseId}:${input.dueDate}:${slug}:${hash}`
}

function isIgnoredLine(line: string): boolean {
  return (
    /^week\s+\d+/i.test(line) ||
    /spring break/i.test(line) ||
    /no assignment/i.test(line) ||
    /no class/i.test(line) ||
    /^bring\b/i.test(line) ||
    /^no books/i.test(line) ||
    /^no devices/i.test(line) ||
    /^no screens/i.test(line) ||
    /^you can use/i.test(line)
  )
}

function titleFromLine(line: string): string | null {
  const read = line.match(READ_LINE_RE)
  if (read?.[1]) return `Read: ${read[1].trim()}`
  const quiz = line.match(QUIZ_LINE_RE)
  if (quiz?.[1]) return quiz[1].replace(/\s+/g, " ").trim()
  return null
}

export function parseDatedReadingSchedule(
  input: DatedReadingScheduleInput,
): CourseWorkItem[] {
  const now = input.now ?? new Date()
  const year = inferYear(input.course, now)
  const text = normalizeCanvasPageText(input.body)
  const items: CourseWorkItem[] = []
  let currentDueAt: string | null = null

  for (const line of text.split("\n")) {
    const dateMatch = line.match(DATE_LINE_RE)
    if (dateMatch?.[1] && dateMatch[2]) {
      const month = MONTHS.get(dateMatch[1].toLowerCase())
      const day = Number.parseInt(dateMatch[2], 10)
      currentDueAt = month === undefined ? null : dueAtIso(year, month, day)
      if (isIgnoredLine(line)) continue
    }

    if (!currentDueAt || isIgnoredLine(line)) continue

    const title = titleFromLine(line)
    if (!title) continue

    const dueDate = currentDueAt.slice(0, 10)
    const id = stableItemId({
      courseId: input.course.id,
      sourceId: input.sourceId,
      dueDate,
      title,
    })

    items.push({
      id: id as CourseWorkItem["id"],
      courseId: input.course.id,
      title,
      description: `Inferred from remembered Canvas page: ${input.sourceUrl}`,
      effectiveDueAt: currentDueAt,
      sourceType: "page",
      sourceId: `${input.sourceId}:${dueDate}:${slugify(title)}`,
      sourceDueDateKind: "inferred",
      freshnessStatus: "fresh",
      cachedAt: now.toISOString(),
      lastVerifiedAt: now.toISOString(),
      sourceUpdatedAt: input.sourceUpdatedAt,
      htmlUrl: input.sourceUrl,
    })
  }

  return items
}
