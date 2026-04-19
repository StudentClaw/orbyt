import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { isoWeekKey, parseIsoDate } from "./week.js"
import type { MemoryPaths } from "./paths.js"
import type { MemorizeDistiller } from "./distiller.js"
import { fillTemplate, WEEKLY_DISTILLATION_PROMPT } from "./prompts/index.js"

const WEEKLY_EMPTY = `## Recurring Struggles

_none_

## Recurring Wins

_none_

## Emerging Study Strategies

_none_

## Candidate Long-Term Lessons

_none_
`

export function weekKeyForDailyDate(dateKey: string): string {
  return isoWeekKey(parseIsoDate(dateKey))
}

export async function foldDailyIntoWeekly(
  paths: MemoryPaths,
  distiller: MemorizeDistiller,
  dailyDateKey: string,
  dailyContent: string,
): Promise<string> {
  const weekKey = weekKeyForDailyDate(dailyDateKey)
  const weeklyPath = paths.weeklyFile(weekKey)
  const existingWeekly = existsSync(weeklyPath)
    ? readFileSync(weeklyPath, "utf-8")
    : `# Weekly - ${weekKey}\n\n${WEEKLY_EMPTY}`

  const prompt = fillTemplate(WEEKLY_DISTILLATION_PROMPT, {
    daily_date: dailyDateKey,
    daily_content: dailyContent,
    week_key: weekKey,
    weekly_content: existingWeekly,
  })

  const aiOutput = await distiller.distill(prompt)

  mkdirSync(dirname(weeklyPath), { recursive: true })
  writeFileSync(
    weeklyPath,
    `# Weekly - ${weekKey}\n\n${aiOutput.trimEnd()}\n`,
    "utf-8",
  )

  return weekKey
}
