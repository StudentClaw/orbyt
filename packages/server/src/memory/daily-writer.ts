import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { isoDateKey, runLabel } from "./week.js"
import type { MemoryPaths } from "./paths.js"

export function buildDailyRunBlock(aiOutput: string, now: Date): string {
  return `## Run ${runLabel(now)}\n\n${aiOutput.trimEnd()}\n`
}

export function writeDailyFile(
  paths: MemoryPaths,
  aiOutput: string,
  now: Date,
): string {
  const dateKey = isoDateKey(now)
  const filePath = paths.dailyFile(dateKey)
  const block = buildDailyRunBlock(aiOutput, now)

  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, "utf-8")
    writeFileSync(filePath, `${existing.trimEnd()}\n\n---\n\n${block}`, "utf-8")
  } else {
    writeFileSync(filePath, `# Daily - ${dateKey}\n\n${block}`, "utf-8")
  }

  return dateKey
}

export function readDailyFile(paths: MemoryPaths, dateKey: string): string | null {
  const filePath = paths.dailyFile(dateKey)
  return existsSync(filePath) ? readFileSync(filePath, "utf-8") : null
}
