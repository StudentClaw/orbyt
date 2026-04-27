import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import type { Course } from "@orbyt/contracts"
import type { MemoryPaths } from "./paths.js"
import { logMemoryWrite } from "./write-log.js"

const NONE_PLACEHOLDER = "_none yet_"
const COURSE_SECTIONS = [
  "## Purpose",
  "## Linked Nodes",
  "## Durable Facts",
  "## Canvas Layout",
  "## Professor Patterns",
  "## Assignment Strategy",
  "## Assignment Source Rules",
  "## Assignment Source Discovery",
  "## Recurring Pitfalls",
  "## Current Improvements",
  "## Observed Patterns",
  "## Evidence",
] as const

type CourseNodeFrontmatter = {
  readonly slug?: string
  readonly canvasId?: string
}

export function normalizeCourseSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function quoteYaml(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`
}

function readFrontmatter(content: string): CourseNodeFrontmatter {
  if (!content.startsWith("---\n")) return {}
  const end = content.indexOf("\n---", 4)
  if (end < 0) return {}
  const raw = content.slice(4, end)
  const result: { slug?: string; canvasId?: string } = {}
  for (const line of raw.split("\n")) {
    const [rawKey, ...rest] = line.split(":")
    const key = rawKey?.trim()
    if (!key) continue
    const value = rest.join(":").trim().replace(/^"|"$/g, "")
    if (key === "slug" && value) result.slug = value
    if (key === "canvasId" && value && value !== "null") result.canvasId = value
  }
  return result
}

function frontmatterForCourse(course: Course, slug: string, createdAt: string, updatedAt: string): string[] {
  return [
    "---",
    `slug: ${slug}`,
    `canvasId: ${course.canvasId ?? "null"}`,
    `canvasName: ${quoteYaml(course.name)}`,
    `courseCode: ${quoteYaml(course.code)}`,
    `term: ${quoteYaml(course.term ?? "")}`,
    `createdAt: ${quoteYaml(createdAt)}`,
    `updatedAt: ${quoteYaml(updatedAt)}`,
    "---",
  ]
}

function ensureSection(content: string, heading: string): string {
  const lines = content.split("\n")
  if (lines.some((line) => line.trim() === heading)) return content
  return `${content.trimEnd()}\n\n${heading}\n\n${NONE_PLACEHOLDER}\n`
}

function seedCourseNode(course: Course, slug: string, nowIso: string): string {
  return [
    ...frontmatterForCourse(course, slug, nowIso, nowIso),
    "",
    `# ${course.name}`,
    "",
    ...COURSE_SECTIONS.flatMap((heading) => [heading, "", NONE_PLACEHOLDER, ""]),
  ].join("\n")
}

function updateFrontmatter(content: string, course: Course, slug: string, nowIso: string): string {
  const normalized = content.replace(/\r\n/g, "\n")
  if (!normalized.startsWith("---\n")) {
    return [
      ...frontmatterForCourse(course, slug, nowIso, nowIso),
      "",
      normalized.trimStart(),
    ].join("\n")
  }

  const end = normalized.indexOf("\n---", 4)
  if (end < 0) {
    return [
      ...frontmatterForCourse(course, slug, nowIso, nowIso),
      "",
      normalized.trimStart(),
    ].join("\n")
  }

  const frontmatter = normalized.slice(4, end).split("\n")
  const rest = normalized.slice(end + 4)
  const desired = new Map([
    ["slug", slug],
    ["canvasId", course.canvasId ?? "null"],
    ["canvasName", quoteYaml(course.name)],
    ["courseCode", quoteYaml(course.code)],
    ["term", quoteYaml(course.term ?? "")],
    ["updatedAt", quoteYaml(nowIso)],
  ])
  if (!frontmatter.some((line) => line.trim().startsWith("createdAt:"))) {
    desired.set("createdAt", quoteYaml(nowIso))
  }

  const used = new Set<string>()
  const updated = frontmatter.map((line) => {
    const [rawKey] = line.split(":")
    const key = rawKey?.trim() ?? ""
    const value = desired.get(key)
    if (value === undefined) return line
    used.add(key)
    return `${key}: ${value}`
  })

  for (const [key, value] of desired) {
    if (!used.has(key)) updated.push(`${key}: ${value}`)
  }

  return `---\n${updated.join("\n")}\n---${rest}`
}

function listCourseNodePaths(paths: MemoryPaths): string[] {
  if (!existsSync(paths.coursesDir)) return []
  return readdirSync(paths.coursesDir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return []
    const nodePath = join(paths.coursesDir, entry.name, "index.md")
    return existsSync(nodePath) ? [nodePath] : []
  })
}

function findExistingCourseNode(paths: MemoryPaths, course: Course): string | null {
  const candidates = listCourseNodePaths(paths)
  const normalizedCode = normalizeCourseSlug(course.code)
  const normalizedName = normalizeCourseSlug(course.name)

  if (course.canvasId) {
    for (const nodePath of candidates) {
      const frontmatter = readFrontmatter(readFileSync(nodePath, "utf-8"))
      if (frontmatter.canvasId === course.canvasId) return nodePath
    }
  }

  for (const nodePath of candidates) {
    const slug = basename(dirname(nodePath))
    const frontmatter = readFrontmatter(readFileSync(nodePath, "utf-8"))
    if (
      slug === normalizedCode ||
      slug === normalizedName ||
      frontmatter.slug === normalizedCode ||
      frontmatter.slug === normalizedName
    ) {
      return nodePath
    }
  }

  return null
}

function nextAvailableSlug(paths: MemoryPaths, baseSlug: string): string {
  let slug = baseSlug
  let index = 2
  while (existsSync(paths.courseIndex(slug))) {
    slug = `${baseSlug}-${index}`
    index += 1
  }
  return slug
}

function preferredSlug(course: Course): string {
  return (
    normalizeCourseSlug(course.code) ||
    normalizeCourseSlug(course.name) ||
    (course.canvasId ? `canvas-${course.canvasId}` : "course")
  )
}

export function ensureCanvasCourseMemoryNodes(
  paths: MemoryPaths,
  courses: readonly Course[],
  now: Date = new Date(),
): string[] {
  const nowIso = now.toISOString()
  const written: string[] = []
  mkdirSync(paths.coursesDir, { recursive: true })

  for (const course of courses) {
    const existingPath = findExistingCourseNode(paths, course)
    const nodePath = existingPath ?? paths.courseIndex(nextAvailableSlug(paths, preferredSlug(course)))
    const slug = basename(dirname(nodePath))
    const content = existingPath && existsSync(existingPath)
      ? readFileSync(existingPath, "utf-8")
      : seedCourseNode(course, slug, nowIso)

    let updated = existingPath
      ? updateFrontmatter(content, course, slug, nowIso)
      : content

    for (const heading of COURSE_SECTIONS) {
      updated = ensureSection(updated, heading)
    }

    mkdirSync(dirname(nodePath), { recursive: true })
    writeFileSync(nodePath, updated, "utf-8")
    logMemoryWrite(existingPath ? "course memory node update" : "course memory node create", nodePath, updated)
    written.push(nodePath)
  }

  return written
}
