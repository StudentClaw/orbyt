import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import type { DatabaseService } from "../db/Database.js"
import { createMemoryPaths } from "../memory/paths.js"

type MemoryGraphPreferenceRow = {
  memory_graph_path: string | null
}

const MAX_FILE_CHARS = 6_000
const MAX_TOTAL_CHARS = 24_000

function readMemoryGraphOverride(database: DatabaseService): string | null {
  try {
    const row = database.get<MemoryGraphPreferenceRow>(
      "SELECT memory_graph_path FROM user_preferences WHERE id = 1",
    )
    return row?.memory_graph_path ?? null
  } catch {
    return null
  }
}

function addIfExists(files: string[], filePath: string): void {
  if (existsSync(filePath) && !files.includes(filePath)) {
    files.push(filePath)
  }
}

function addMarkdownChildren(files: string[], dirPath: string): void {
  if (!existsSync(dirPath)) return
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      addIfExists(files, join(dirPath, entry.name, "index.md"))
      continue
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      addIfExists(files, join(dirPath, entry.name))
    }
  }
}

function collectMemoryFiles(paths: ReturnType<typeof createMemoryPaths>): string[] {
  const files: string[] = []

  addIfExists(files, paths.memoryFile)
  addIfExists(files, join(paths.graphDir, "index.md"))
  addIfExists(files, paths.branchIndex("school"))
  addIfExists(files, join(paths.graphDir, "personality", "index.md"))
  addMarkdownChildren(files, paths.coursesDir)
  addMarkdownChildren(files, paths.playbooksDir)

  return files
}

function formatMemoryFile(paths: ReturnType<typeof createMemoryPaths>, filePath: string): string | null {
  const raw = readFileSync(filePath, "utf8").trim()
  if (raw.length === 0) return null
  const label = relative(paths.graphDir, filePath).startsWith("..")
    ? filePath
    : relative(paths.graphDir, filePath)
  const content = raw.length > MAX_FILE_CHARS
    ? `${raw.slice(0, MAX_FILE_CHARS)}\n...[truncated]`
    : raw
  return `## ${label}\n\n${content}`
}

/**
 * Builds a compact durable-memory context block for skill prompts that request
 * `memory.read`. The markdown graph remains the source of truth; this only
 * surfaces the student's saved facts/preferences to the assistant turn.
 */
export function buildMemoryContext(
  database: DatabaseService,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const paths = createMemoryPaths({
    env,
    graphDirOverride: readMemoryGraphOverride(database),
  })
  const files = collectMemoryFiles(paths)

  if (files.length === 0) {
    return [
      "[Memory Context]",
      `Durable memory graph: ${paths.graphDir}`,
      "No durable memory markdown files were found.",
    ].join("\n")
  }

  const sections: string[] = []
  let totalChars = 0
  for (const filePath of files) {
    const formatted = formatMemoryFile(paths, filePath)
    if (!formatted) continue
    if (totalChars + formatted.length > MAX_TOTAL_CHARS) {
      sections.push("...[memory context truncated]")
      break
    }
    sections.push(formatted)
    totalChars += formatted.length
  }

  return [
    "[Memory Context]",
    `Durable memory graph: ${paths.graphDir}`,
    "Use these saved facts as preferences and durable course notes. Do not treat them as live calendar availability.",
    "",
    ...sections,
  ].join("\n")
}
