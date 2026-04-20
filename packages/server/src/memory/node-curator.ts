import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { MemoryPaths } from "./paths.js"
import type { DatabaseService } from "../db/Database.js"

type CourseCodeRow = { code: string }

function courseCodeToSlug(code: string): string {
  return code.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

function assertSafeFrontmatterValue(value: string): void {
  if (/[\r\n]/.test(value)) {
    throw new Error(`Frontmatter value must not contain newlines: ${JSON.stringify(value)}`)
  }
}

function setFrontmatterField(content: string, key: string, value: string): string {
  assertSafeFrontmatterValue(value)

  // Normalize line endings so \r\n files parse correctly.
  const normalized = content.replace(/\r\n/g, "\n")

  if (!normalized.startsWith("---")) return content

  const endIdx = normalized.indexOf("\n---", 3)
  if (endIdx < 0) return content

  const frontmatter = normalized.slice(3, endIdx)
  const rest = normalized.slice(endIdx + 4)

  const keyPattern = new RegExp(`^${key}:.*$`, "m")
  const newLine = `${key}: ${value}`

  const updatedFrontmatter = keyPattern.test(frontmatter)
    ? frontmatter.replace(keyPattern, newLine)
    : frontmatter + `\n${newLine}`

  return `---${updatedFrontmatter}\n---${rest}`
}

export function markStaleCourseNodes(
  paths: MemoryPaths,
  db: DatabaseService,
  now: Date,
): string[] {
  if (!existsSync(paths.coursesDir)) return []

  const activeSlugs = new Set(
    db.query<CourseCodeRow>(`SELECT code FROM courses`).map((r) => courseCodeToSlug(r.code)),
  )

  const staleFiles: string[] = []

  for (const entry of readdirSync(paths.coursesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = entry.name
    if (activeSlugs.has(dir)) continue

    const indexPath = join(paths.coursesDir, dir, "index.md")
    if (!existsSync(indexPath)) continue

    const content = readFileSync(indexPath, "utf-8")
    if (!content.startsWith("---")) continue

    const withStale = setFrontmatterField(content, "_stale", "true")
    const withStaleAt = setFrontmatterField(withStale, "_staleAt", now.toISOString())
    writeFileSync(indexPath, withStaleAt, "utf-8")
    staleFiles.push(indexPath)
  }

  return staleFiles
}
