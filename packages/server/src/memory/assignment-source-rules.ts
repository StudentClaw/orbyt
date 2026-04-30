import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createHash } from "node:crypto"
import type { DatabaseService } from "../db/Database.js"
import type { MemoryPaths } from "./paths.js"
import { logMemoryWrite } from "./write-log.js"

export type AssignmentSourceKind = "canvas_page"
export type AssignmentSourceParser = "dated_reading_schedule"

export interface AssignmentSourceRule {
  readonly id: string
  readonly kind: AssignmentSourceKind
  readonly canvasCourseId: string
  readonly url: string
  readonly parser: AssignmentSourceParser
  readonly purpose: string | null
  readonly enabled: boolean
  readonly graphNodePath: string
  readonly graphRuleIndex: number
  readonly courseSlug: string
}

export interface AssignmentSourceDiscoveryHint {
  readonly id: string
  readonly canvasCourseId: string
  readonly url: string
  readonly parser: AssignmentSourceParser
  readonly possibleContent: readonly string[]
  readonly confidence: number | null
  readonly status: string
  readonly graphNodePath: string
  readonly graphRuleIndex: number
  readonly courseSlug: string
}

export interface AssignmentSourceRulePromotionInput {
  readonly id: string
  readonly canvasCourseId: string
  readonly sourceKind: AssignmentSourceKind
  readonly url: string
  readonly parser: AssignmentSourceParser
  readonly purpose: string | null
  readonly graphNodePath: string | null
}

type CourseLookupRow = {
  id: string
  code: string
  name: string
  canvas_id: string | null
}

type ParsedFrontmatter = {
  readonly canvasId?: string
}

function stableRuleId(input: {
  readonly kind: AssignmentSourceKind
  readonly canvasCourseId: string
  readonly url: string
  readonly parser: AssignmentSourceParser
}): string {
  const hash = createHash("sha1")
    .update(`${input.kind}:${input.canvasCourseId}:${input.parser}:${input.url}`)
    .digest("hex")
    .slice(0, 12)
  return `assignment-source:${hash}`
}

function extractSection(markdown: string, heading: string): string | null {
  const lines = markdown.split("\n")
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i]?.startsWith("## ")) {
      end = i
      break
    }
  }
  return lines.slice(start + 1, end).join("\n")
}

function extractJsonBlocks(section: string): string[] {
  const blocks: string[] = []
  const fenced = /```(?:json)?\s*([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = fenced.exec(section))) {
    const body = match[1]?.trim()
    if (body) blocks.push(body)
  }
  return blocks
}

function appendJsonBlockToSection(markdown: string, heading: string, block: string): string {
  const lines = markdown.split("\n")
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start < 0) {
    return `${markdown.trimEnd()}\n\n${heading}\n\n${block}\n`
  }

  let end = lines.length
  for (let index = start + 1; index < lines.length; index++) {
    if (lines[index]?.startsWith("## ")) {
      end = index
      break
    }
  }

  const before = lines.slice(0, start + 1)
  const existingSection = lines.slice(start + 1, end).join("\n").trim()
  const after = lines.slice(end)
  const replacementSection =
    existingSection.length === 0 || existingSection === "_none yet_"
      ? ["", block, ""]
      : ["", existingSection, "", block, ""]

  return [...before, ...replacementSection, ...after].join("\n").trimEnd() + "\n"
}

function readFrontmatter(markdown: string): ParsedFrontmatter {
  if (!markdown.startsWith("---\n")) return {}
  const end = markdown.indexOf("\n---", 4)
  if (end < 0) return {}
  const raw = markdown.slice(4, end)
  const result: ParsedFrontmatter = {}
  for (const line of raw.split("\n")) {
    const [key, ...rest] = line.split(":")
    if (!key) continue
    const value = rest.join(":").trim().replace(/^"|"$/g, "")
    if (key.trim() === "canvasId" && value && value !== "null") {
      return { ...result, canvasId: value }
    }
  }
  return result
}

function isSourceKind(value: unknown): value is AssignmentSourceKind {
  return value === "canvas_page"
}

function isSourceParser(value: unknown): value is AssignmentSourceParser {
  return value === "dated_reading_schedule"
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const text = readString(entry)
    return text ? [text] : []
  })
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function normalizeRule(
  value: unknown,
  context: {
    readonly graphNodePath: string
    readonly graphRuleIndex: number
    readonly courseSlug: string
    readonly frontmatter: ParsedFrontmatter
  },
): AssignmentSourceRule | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const kind = record["kind"]
  const parser = record["parser"]
  const url = readString(record["url"])
  const rawCanvasCourseId =
    readString(record["canvasCourseId"]) ??
    readString(record["canvas_course_id"]) ??
    context.frontmatter.canvasId ??
    null

  if (!isSourceKind(kind) || !isSourceParser(parser) || !url || !rawCanvasCourseId) {
    return null
  }

  if (!/^https:\/\//i.test(url)) return null

  const purpose = readString(record["purpose"])
  const enabled = record["enabled"] !== false
  const id =
    readString(record["id"]) ??
    stableRuleId({
      kind,
      canvasCourseId: rawCanvasCourseId,
      url,
      parser,
    })

  return {
    id,
    kind,
    canvasCourseId: rawCanvasCourseId,
    url,
    parser,
    purpose,
    enabled,
    graphNodePath: context.graphNodePath,
    graphRuleIndex: context.graphRuleIndex,
    courseSlug: context.courseSlug,
  }
}

function normalizeDiscoveryHint(
  value: unknown,
  context: {
    readonly graphNodePath: string
    readonly graphRuleIndex: number
    readonly courseSlug: string
    readonly frontmatter: ParsedFrontmatter
  },
): AssignmentSourceDiscoveryHint | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (record["kind"] !== "canvas_assignment_source_hint") return null
  const url = readString(record["url"])
  const rawCanvasCourseId =
    readString(record["canvasCourseId"]) ??
    readString(record["canvas_course_id"]) ??
    context.frontmatter.canvasId ??
    null
  if (!url || !rawCanvasCourseId || !/^https:\/\//i.test(url)) return null
  const parserValue = readString(record["parser"]) ?? "dated_reading_schedule"
  if (!isSourceParser(parserValue)) return null

  return {
    id: readString(record["id"]) ?? stableRuleId({
      kind: "canvas_page",
      canvasCourseId: rawCanvasCourseId,
      url,
      parser: parserValue,
    }),
    canvasCourseId: rawCanvasCourseId,
    url,
    parser: parserValue,
    possibleContent: readStringArray(record["possibleContent"]),
    confidence: readNumber(record["confidence"]),
    status: readString(record["status"]) ?? "candidate",
    graphNodePath: context.graphNodePath,
    graphRuleIndex: context.graphRuleIndex,
    courseSlug: context.courseSlug,
  }
}

function parseJsonRuleBlock(
  block: string,
  context: {
    readonly graphNodePath: string
    readonly graphRuleIndex: number
    readonly courseSlug: string
    readonly frontmatter: ParsedFrontmatter
  },
): AssignmentSourceRule[] {
  try {
    const parsed = JSON.parse(block) as unknown
    const values = Array.isArray(parsed) ? parsed : [parsed]
    return values.flatMap((value, offset) => {
      const rule = normalizeRule(value, {
        ...context,
        graphRuleIndex: context.graphRuleIndex + offset,
      })
      return rule ? [rule] : []
    })
  } catch {
    return []
  }
}

export function parseAssignmentSourceRulesFromMarkdown(
  markdown: string,
  graphNodePath: string,
  courseSlug: string,
): AssignmentSourceRule[] {
  const section = extractSection(markdown, "## Assignment Source Rules")
  if (!section) return []
  const frontmatter = readFrontmatter(markdown)
  return extractJsonBlocks(section).flatMap((block, index) =>
    parseJsonRuleBlock(block, {
      graphNodePath,
      graphRuleIndex: index,
      courseSlug,
      frontmatter,
    }),
  )
}

export function parseAssignmentSourceDiscoveryHintsFromMarkdown(
  markdown: string,
  graphNodePath: string,
  courseSlug: string,
): AssignmentSourceDiscoveryHint[] {
  const section = extractSection(markdown, "## Assignment Source Discovery")
  if (!section) return []
  const frontmatter = readFrontmatter(markdown)
  return extractJsonBlocks(section).flatMap((block, index) => {
    try {
      const parsed = JSON.parse(block) as unknown
      const values = Array.isArray(parsed) ? parsed : [parsed]
      return values.flatMap((value, offset) => {
        const hint = normalizeDiscoveryHint(value, {
          graphNodePath,
          graphRuleIndex: index + offset,
          courseSlug,
          frontmatter,
        })
        return hint ? [hint] : []
      })
    } catch {
      return []
    }
  })
}

export function readAssignmentSourceRules(paths: MemoryPaths): AssignmentSourceRule[] {
  if (!existsSync(paths.coursesDir)) return []
  return readdirSync(paths.coursesDir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return []
    const courseSlug = entry.name
    const nodePath = join(paths.coursesDir, courseSlug, "index.md")
    if (!existsSync(nodePath)) return []
    return parseAssignmentSourceRulesFromMarkdown(
      readFileSync(nodePath, "utf-8"),
      nodePath,
      courseSlug,
    )
  })
}

export function readAssignmentSourceDiscoveryHints(paths: MemoryPaths): AssignmentSourceDiscoveryHint[] {
  if (!existsSync(paths.coursesDir)) return []
  return readdirSync(paths.coursesDir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return []
    const courseSlug = entry.name
    const nodePath = join(paths.coursesDir, courseSlug, "index.md")
    if (!existsSync(nodePath)) return []
    return parseAssignmentSourceDiscoveryHintsFromMarkdown(
      readFileSync(nodePath, "utf-8"),
      nodePath,
      courseSlug,
    )
  })
}

function readCourseLookup(database: DatabaseService): CourseLookupRow[] {
  return database.query<CourseLookupRow>(
    "SELECT id, code, name, canvas_id FROM courses ORDER BY name ASC",
  )
}

function normalizeCourseKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function courseMatchesSlug(course: CourseLookupRow, slug: string): boolean {
  const normalizedCode = normalizeCourseKey(course.code)
  const normalizedName = normalizeCourseKey(course.name)
  return (
    normalizedCode === slug ||
    normalizedName === slug ||
    normalizedName.startsWith(`${slug}-`) ||
    normalizedName.endsWith(`-${slug}`) ||
    normalizedName.includes(`-${slug}-`)
  )
}

function resolveLocalCourseId(
  rule: AssignmentSourceRule,
  courses: readonly CourseLookupRow[],
): string | null {
  const byCanvasId = courses.find((course) => course.canvas_id === rule.canvasCourseId)
  if (byCanvasId) return byCanvasId.id

  const slugMatches = courses.filter((course) => courseMatchesSlug(course, rule.courseSlug))
  return slugMatches.length === 1 ? slugMatches[0]!.id : null
}

export function projectAssignmentSourceRules(
  database: DatabaseService,
  paths: MemoryPaths,
): AssignmentSourceRule[] {
  const rules = readAssignmentSourceRules(paths)
  const courses = readCourseLookup(database)
  const seen = new Set<string>()
  const now = new Date().toISOString()

  for (const rule of rules) {
    seen.add(rule.id)
    const localCourseId = resolveLocalCourseId(rule, courses)
    database.execute(
      `INSERT INTO course_assignment_sources
         (id, local_course_id, canvas_course_id, source_kind, url, parser, purpose,
          enabled, graph_node_path, graph_rule_index, updated_at, last_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         local_course_id = excluded.local_course_id,
         canvas_course_id = excluded.canvas_course_id,
         source_kind = excluded.source_kind,
         url = excluded.url,
         parser = excluded.parser,
         purpose = excluded.purpose,
         enabled = excluded.enabled,
         graph_node_path = excluded.graph_node_path,
         graph_rule_index = excluded.graph_rule_index,
         updated_at = excluded.updated_at,
         last_error = CASE
           WHEN excluded.local_course_id IS NULL THEN excluded.last_error
           ELSE course_assignment_sources.last_error
         END`,
      [
        rule.id,
        localCourseId,
        rule.canvasCourseId,
        rule.kind,
        rule.url,
        rule.parser,
        rule.purpose,
        rule.enabled ? 1 : 0,
        rule.graphNodePath,
        rule.graphRuleIndex,
        now,
        localCourseId ? null : "No matching local Canvas course.",
      ],
    )
  }

  if (seen.size > 0) {
    const placeholders = [...seen].map(() => "?").join(", ")
    database.execute(
      `UPDATE course_assignment_sources
       SET enabled = 0, updated_at = ?
       WHERE id NOT IN (${placeholders})`,
      [now, ...seen],
    )
  } else {
    database.execute(
      "UPDATE course_assignment_sources SET enabled = 0, updated_at = ?",
      [now],
    )
  }

  return rules
}

export function projectAssignmentSourceDiscoveryHints(
  database: DatabaseService,
  paths: MemoryPaths,
  confirmedRules: readonly AssignmentSourceRule[] = readAssignmentSourceRules(paths),
): AssignmentSourceDiscoveryHint[] {
  const hints = readAssignmentSourceDiscoveryHints(paths)
  const courses = readCourseLookup(database)
  const confirmedCanvasCourseIds = new Set(
    confirmedRules
      .filter((rule) => rule.enabled)
      .map((rule) => rule.canvasCourseId),
  )
  const now = new Date().toISOString()

  for (const hint of hints) {
    if (hint.status === "rejected" || confirmedCanvasCourseIds.has(hint.canvasCourseId)) {
      continue
    }
    const localCourseId = resolveLocalCourseId(
      {
        id: stableRuleId({
          kind: "canvas_page",
          canvasCourseId: hint.canvasCourseId,
          url: hint.url,
          parser: hint.parser,
        }),
        kind: "canvas_page",
        canvasCourseId: hint.canvasCourseId,
        url: hint.url,
        parser: hint.parser,
        purpose: hint.possibleContent.length > 0 ? hint.possibleContent.join(", ") : "possible_assignment_source",
        enabled: true,
        graphNodePath: hint.graphNodePath,
        graphRuleIndex: hint.graphRuleIndex,
        courseSlug: hint.courseSlug,
      },
      courses,
    )
    database.execute(
      `INSERT INTO course_assignment_sources
         (id, local_course_id, canvas_course_id, source_kind, url, parser, purpose,
          enabled, graph_node_path, graph_rule_index, updated_at, last_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         local_course_id = excluded.local_course_id,
         canvas_course_id = excluded.canvas_course_id,
         source_kind = excluded.source_kind,
         url = excluded.url,
         parser = excluded.parser,
         purpose = excluded.purpose,
         enabled = excluded.enabled,
         graph_node_path = excluded.graph_node_path,
         graph_rule_index = excluded.graph_rule_index,
         updated_at = excluded.updated_at,
         last_error = CASE
           WHEN excluded.local_course_id IS NULL THEN excluded.last_error
           ELSE course_assignment_sources.last_error
         END`,
      [
        stableRuleId({
          kind: "canvas_page",
          canvasCourseId: hint.canvasCourseId,
          url: hint.url,
          parser: hint.parser,
        }),
        localCourseId,
        hint.canvasCourseId,
        "canvas_page",
        hint.url,
        hint.parser,
        hint.possibleContent.length > 0 ? hint.possibleContent.join(", ") : "possible_assignment_source",
        1,
        hint.graphNodePath,
        hint.graphRuleIndex,
        now,
        localCourseId ? null : "No matching local Canvas course.",
      ],
    )
  }

  return hints
}

export function promoteAssignmentSourceRuleInMemory(
  source: AssignmentSourceRulePromotionInput,
): boolean {
  if (!source.graphNodePath || !existsSync(source.graphNodePath)) return false

  const markdown = readFileSync(source.graphNodePath, "utf-8")
  const existingRules = parseAssignmentSourceRulesFromMarkdown(
    markdown,
    source.graphNodePath,
    "",
  )
  if (existingRules.some((rule) => rule.id === source.id || rule.url === source.url)) {
    return false
  }

  const block = [
    "```json",
    JSON.stringify({
      id: source.id,
      kind: source.sourceKind,
      canvasCourseId: source.canvasCourseId,
      url: source.url,
      purpose: source.purpose ?? "possible_assignment_source",
      parser: source.parser,
      enabled: true,
    }, null, 2),
    "```",
  ].join("\n")
  const next = appendJsonBlockToSection(markdown, "## Assignment Source Rules", block)
  writeFileSync(source.graphNodePath, next, "utf-8")
  logMemoryWrite("promoted assignment source rule", source.graphNodePath, next)
  return true
}
