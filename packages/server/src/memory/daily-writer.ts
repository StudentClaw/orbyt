import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { isoDateKey, runLabel } from "./week.js"
import type { MemoryPaths } from "./paths.js"
import { logMemoryWrite } from "./write-log.js"

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

  const content = existsSync(filePath)
    ? `${readFileSync(filePath, "utf-8").trimEnd()}\n\n---\n\n${block}`
    : `# Daily - ${dateKey}\n\n${block}`
  writeFileSync(filePath, content, "utf-8")
  logMemoryWrite("daily memory", filePath, content)

  return dateKey
}

export function readDailyFile(paths: MemoryPaths, dateKey: string): string | null {
  const filePath = paths.dailyFile(dateKey)
  return existsSync(filePath) ? readFileSync(filePath, "utf-8") : null
}

const RECAP_MARKER = "## End-of-Day Recap"

function buildRecapBlock(aiOutput: string): string {
  return `${RECAP_MARKER}\n\n${aiOutput.trimEnd()}\n`
}

export function appendRecapBlock(
  paths: MemoryPaths,
  dateKey: string,
  aiOutput: string,
): string | null {
  const filePath = paths.dailyFile(dateKey)
  const block = buildRecapBlock(aiOutput)

  let content: string
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, "utf-8")
    if (existing.includes(RECAP_MARKER)) {
      // Replace prior recap block rather than duplicating it.
      const replaced = existing.replace(
        /## End-of-Day Recap[\s\S]*$/,
        block,
      )
      content = replaced.trimEnd() + "\n"
    } else {
      content = `${existing.trimEnd()}\n\n---\n\n${block}`
    }
  } else {
    content = `# Daily - ${dateKey}\n\n${block}`
  }
  writeFileSync(filePath, content, "utf-8")
  logMemoryWrite("daily recap memory", filePath, content)

  return dateKey
}
