import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { createHash } from "node:crypto"
import { SCAFFOLD_BRANCHES, type ScaffoldBranch } from "@orbyt/contracts"
import type { MemoryPaths } from "./paths.js"
import type { ParsedCandidate } from "./candidate-parser.js"
import { logMemoryWrite } from "./write-log.js"

const VALID_SCAFFOLD_BRANCHES = new Set<string>(SCAFFOLD_BRANCHES)
const SLUG_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
type GraphCandidateInput = Pick<ParsedCandidate, "branch" | "text">

function validateBranchSegments(branch: string): void {
  const segments = branch.split("/").filter(Boolean)
  for (const seg of segments) {
    if (!SLUG_SEGMENT_PATTERN.test(seg)) {
      throw new Error(`Invalid branch segment "${seg}" in branch: ${branch}`)
    }
  }
  const root = segments[0] ?? ""
  if (!VALID_SCAFFOLD_BRANCHES.has(root)) {
    throw new Error(`Unknown branch root "${root}" in branch: ${branch}`)
  }
}

const NONE_PLACEHOLDER = "_none yet_"

const CANVAS_RE = /canvas|module|assignment tab|pages tab|announcement|navigation/i
const PROFESSOR_RE = /professor|prof |instructor|dr\.|grader|rubric|submission format|late polic/i
const PITFALL_RE = /pitfall|mistake|avoid|don't|beware|warning/i
const ASSIGNMENT_RE = /assignment|homework|problem set|lab|essay|project|quiz|exam strateg/i
const CANVAS_URL_RE = /https:\/\/[^\s)"']*\/courses\/(\d+)\/(?:wiki|pages\/[^\s)"']+)/i
const CANVAS_COURSE_URL_RE = /https:\/\/[^\s)"']*\/courses\/(\d+)(?:\/(?:wiki|pages\/[^\s)"']+))?/i
const ASSIGNMENT_SOURCE_SIGNAL_RE = /read|reading|homework|assignment|assignments|quiz|quizzes|schedule|deadline|due|module|syllabus|weekly|work is|work's|real work/i

function selectCourseSection(text: string): string {
  if (CANVAS_RE.test(text)) return "## Canvas Layout"
  if (PROFESSOR_RE.test(text)) return "## Professor Patterns"
  if (PITFALL_RE.test(text)) return "## Recurring Pitfalls"
  if (ASSIGNMENT_RE.test(text)) return "## Assignment Strategy"
  return "## Durable Facts"
}

function appendBulletToSection(
  content: string,
  heading: string,
  bullet: string,
): string {
  const lines = content.split("\n")
  let sectionStart = -1
  let nextSectionStart = lines.length

  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.trim() === heading) {
      sectionStart = i
    } else if (sectionStart >= 0 && i > sectionStart && lines[i]?.startsWith("## ")) {
      nextSectionStart = i
      break
    }
  }

  if (sectionStart < 0) {
    return `${content.trimEnd()}\n\n${heading}\n\n${bullet}\n`
  }

  const before = lines.slice(0, nextSectionStart)
  const after = lines.slice(nextSectionStart)

  const sectionLines = before.slice(sectionStart + 1)
  const nonEmpty = sectionLines.filter((l) => l.trim() !== NONE_PLACEHOLDER && l.trim() !== "")

  const updatedSection = [
    heading,
    "",
    ...nonEmpty,
    bullet,
    "",
  ]

  return [...before.slice(0, sectionStart), ...updatedSection, ...after]
    .join("\n")
    .trimEnd() + "\n"
}

function appendRuleToSection(content: string, rule: Record<string, unknown>): string {
  const block = [
    "```json",
    JSON.stringify(rule, null, 2),
    "```",
  ].join("\n")
  return appendBulletToSection(content, "## Assignment Source Rules", block)
}

function appendDiscoveryToSection(content: string, hint: Record<string, unknown>): string {
  const block = [
    "```json",
    JSON.stringify(hint, null, 2),
    "```",
  ].join("\n")
  return appendBulletToSection(content, "## Assignment Source Discovery", block)
}

function sourceRuleId(url: string): string {
  return `assignment-source:${createHash("sha1").update(url).digest("hex").slice(0, 12)}`
}

function sourceHintId(url: string): string {
  return `assignment-source-hint:${createHash("sha1").update(url).digest("hex").slice(0, 12)}`
}

function possibleContentFromText(text: string): string[] {
  const content = new Set<string>()
  if (/read|reading/i.test(text)) content.add("readings")
  if (/homework|assignment|assignments|work is|work's|real work/i.test(text)) content.add("assignments")
  if (/quiz|quizzes/i.test(text)) content.add("quizzes")
  if (/schedule|weekly/i.test(text)) content.add("weekly schedule")
  if (/deadline|due/i.test(text)) content.add("deadlines")
  if (/module/i.test(text)) content.add("modules")
  if (/syllabus/i.test(text)) content.add("syllabus")
  return [...content]
}

function extractAssignmentSourceRule(text: string): Record<string, unknown> | null {
  const match = text.match(CANVAS_URL_RE)
  if (!match?.[0] || !match[1]) return null
  if (!ASSIGNMENT_SOURCE_SIGNAL_RE.test(text)) return null
  return {
    id: sourceRuleId(match[0]),
    kind: "canvas_page",
    canvasCourseId: match[1],
    url: match[0],
    purpose: "reading_homework_schedule",
    parser: "dated_reading_schedule",
    enabled: true,
  }
}

function extractAssignmentSourceDiscoveryHint(text: string): Record<string, unknown> | null {
  const match = text.match(CANVAS_COURSE_URL_RE)
  if (!match?.[0] || !match[1]) return null
  if (!ASSIGNMENT_SOURCE_SIGNAL_RE.test(text)) return null
  const possibleContent = possibleContentFromText(text)
  return {
    id: sourceHintId(match[0]),
    kind: "canvas_assignment_source_hint",
    canvasCourseId: match[1],
    url: match[0],
    userLanguage: text,
    possibleContent: possibleContent.length > 0 ? possibleContent : ["coursework"],
    parser: "dated_reading_schedule",
    confidence: 0.75,
    status: "candidate",
  }
}

function resolvePath(paths: MemoryPaths, branch: string): string {
  validateBranchSegments(branch)
  const parts = branch.split("/").filter(Boolean)
  if (parts[0] === "school" && parts[1] === "courses" && parts[2]) {
    return paths.courseIndex(parts[2])
  }
  if (parts[0] === "school" && parts[1] === "playbooks" && parts[2]) {
    return paths.playbookFile(parts[2])
  }
  const root = (parts[0] ?? "school") as ScaffoldBranch
  return paths.branchIndex(root)
}

function extractCanvasCourseId(text: string): string | null {
  return text.match(CANVAS_COURSE_URL_RE)?.[1] ?? null
}

function readCanvasIdFromFrontmatter(content: string): string | null {
  if (!content.startsWith("---\n")) return null
  const end = content.indexOf("\n---", 4)
  if (end < 0) return null
  for (const line of content.slice(4, end).split("\n")) {
    const [key, ...rest] = line.split(":")
    if (key?.trim() !== "canvasId") continue
    const value = rest.join(":").trim().replace(/^"|"$/g, "")
    return value && value !== "null" ? value : null
  }
  return null
}

function findCourseNodeByCanvasId(paths: MemoryPaths, canvasId: string): string | null {
  if (!existsSync(paths.coursesDir)) return null
  for (const entry of readdirSync(paths.coursesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const nodePath = join(paths.coursesDir, entry.name, "index.md")
    if (!existsSync(nodePath)) continue
    if (readCanvasIdFromFrontmatter(readFileSync(nodePath, "utf-8")) === canvasId) {
      return nodePath
    }
  }
  return null
}

function resolveCandidatePath(paths: MemoryPaths, candidate: GraphCandidateInput): string {
  const parts = candidate.branch.split("/").filter(Boolean)
  if (parts[0] === "school" && parts[1] === "courses") {
    const canvasId = extractCanvasCourseId(candidate.text)
    if (canvasId) {
      const existing = findCourseNodeByCanvasId(paths, canvasId)
      if (existing) return existing
    }
  }
  return resolvePath(paths, candidate.branch)
}

function seedBaseNode(heading: string): string {
  return [
    `# ${heading}`,
    "",
    "## Purpose",
    "",
    NONE_PLACEHOLDER,
    "",
    "## Linked Nodes",
    "",
    NONE_PLACEHOLDER,
    "",
    "## Durable Facts",
    "",
    NONE_PLACEHOLDER,
    "",
    "## Observed Patterns",
    "",
    NONE_PLACEHOLDER,
    "",
    "## Evidence",
    "",
    NONE_PLACEHOLDER,
    "",
  ].join("\n")
}

function seedCourseNode(slug: string): string {
  const now = new Date().toISOString()
  return [
    "---",
    `slug: ${slug}`,
    "canvasId: null",
    `canvasName: "${slug}"`,
    `courseCode: "${slug.toUpperCase()}"`,
    `term: ""`,
    `createdAt: "${now}"`,
    `updatedAt: "${now}"`,
    "---",
    "",
    `# ${slug}`,
    "",
    "## Purpose",
    "",
    NONE_PLACEHOLDER,
    "",
    "## Linked Nodes",
    "",
    NONE_PLACEHOLDER,
    "",
    "## Durable Facts",
    "",
    NONE_PLACEHOLDER,
    "",
    "## Canvas Layout",
    "",
    NONE_PLACEHOLDER,
    "",
    "## Professor Patterns",
    "",
    NONE_PLACEHOLDER,
    "",
    "## Assignment Strategy",
    "",
    NONE_PLACEHOLDER,
    "",
    "## Assignment Source Rules",
    "",
    NONE_PLACEHOLDER,
    "",
    "## Assignment Source Discovery",
    "",
    NONE_PLACEHOLDER,
    "",
    "## Recurring Pitfalls",
    "",
    NONE_PLACEHOLDER,
    "",
    "## Current Improvements",
    "",
    NONE_PLACEHOLDER,
    "",
    "## Observed Patterns",
    "",
    NONE_PLACEHOLDER,
    "",
    "## Evidence",
    "",
    NONE_PLACEHOLDER,
    "",
  ].join("\n")
}

export function ensureGraphScaffold(paths: MemoryPaths): string[] {
  mkdirSync(paths.graphDir, { recursive: true })
  mkdirSync(paths.coursesDir, { recursive: true })
  mkdirSync(paths.playbooksDir, { recursive: true })

  const created: string[] = []

  for (const branch of SCAFFOLD_BRANCHES) {
    const filePath = paths.branchIndex(branch)
    if (existsSync(filePath)) continue
    mkdirSync(dirname(filePath), { recursive: true })
    const content = seedBaseNode(branch)
    writeFileSync(filePath, content, "utf-8")
    logMemoryWrite("graph scaffold memory", filePath, content)
    created.push(filePath)
  }

  return created
}

export function writeGraphCandidate(
  paths: MemoryPaths,
  candidate: GraphCandidateInput,
  now: Date,
): string {
  const filePath = resolveCandidatePath(paths, candidate)
  mkdirSync(dirname(filePath), { recursive: true })

  const parts = candidate.branch.split("/")
  const isCourse = parts[0] === "school" && parts[1] === "courses"
  const slug = parts[2] ?? parts[0] ?? "node"

  const existing = existsSync(filePath) ? readFileSync(filePath, "utf-8") : null
  const content = existing ?? (isCourse ? seedCourseNode(slug) : seedBaseNode(slug))

  const section = isCourse ? selectCourseSection(candidate.text) : "## Durable Facts"
  const bullet = `- ${candidate.text} _(promoted ${now.toISOString().slice(0, 10)})_`

  const withBullet = appendBulletToSection(content, section, bullet)
  const sourceRule = isCourse ? extractAssignmentSourceRule(candidate.text) : null
  const sourceHint = isCourse ? extractAssignmentSourceDiscoveryHint(candidate.text) : null
  const withRule = sourceRule ? appendRuleToSection(withBullet, sourceRule) : withBullet
  const updated = sourceHint ? appendDiscoveryToSection(withRule, sourceHint) : withRule
  writeFileSync(filePath, updated, "utf-8")
  logMemoryWrite("long-term graph memory", filePath, updated)

  return filePath
}
