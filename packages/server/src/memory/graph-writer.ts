import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs"
import { dirname } from "node:path"
import type { MemoryPaths } from "./paths.js"
import type { ParsedCandidate } from "./candidate-parser.js"

const NONE_PLACEHOLDER = "_none yet_"

const CANVAS_RE = /canvas|module|assignment tab|pages tab|announcement|navigation/i
const PROFESSOR_RE = /professor|prof |instructor|dr\.|grader|rubric|submission format|late polic/i
const PITFALL_RE = /pitfall|mistake|avoid|don't|beware|warning/i
const ASSIGNMENT_RE = /assignment|homework|problem set|lab|essay|project|quiz|exam strateg/i

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

function resolvePath(paths: MemoryPaths, branch: string): string {
  const parts = branch.split("/")
  if (parts[0] === "school" && parts[1] === "courses" && parts[2]) {
    return paths.courseIndex(parts[2])
  }
  if (parts[0] === "school" && parts[1] === "playbooks" && parts[2]) {
    return paths.playbookFile(parts[2])
  }
  const scaffold = (parts[0] ?? "school") as Parameters<typeof paths.branchIndex>[0]
  return paths.branchIndex(scaffold as never)
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

export function writeGraphCandidate(
  paths: MemoryPaths,
  candidate: ParsedCandidate,
  now: Date,
): string {
  const filePath = resolvePath(paths, candidate.branch)
  mkdirSync(dirname(filePath), { recursive: true })

  const parts = candidate.branch.split("/")
  const isCourse = parts[0] === "school" && parts[1] === "courses"
  const slug = parts[2] ?? parts[0] ?? "node"

  const existing = existsSync(filePath) ? readFileSync(filePath, "utf-8") : null
  const content = existing ?? (isCourse ? seedCourseNode(slug) : seedBaseNode(slug))

  const section = isCourse ? selectCourseSection(candidate.text) : "## Durable Facts"
  const bullet = `- ${candidate.text} _(promoted ${now.toISOString().slice(0, 10)})_`

  const updated = appendBulletToSection(content, section, bullet)
  writeFileSync(filePath, updated, "utf-8")

  return filePath
}
