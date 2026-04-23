import { readdirSync, rmSync, existsSync } from "node:fs"
import { join } from "node:path"
import {
  DAILY_RETENTION,
  WEEKLY_RETENTION,
} from "@orbyt/contracts"
import { readDailyFile } from "./daily-writer.js"
import { foldDailyIntoWeekly } from "./weekly-writer.js"
import type { MemoryPaths } from "./paths.js"
import type { MemorizeDistiller } from "./distiller.js"

function listSortedFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort()
}

export function listDailyKeys(paths: MemoryPaths): string[] {
  return listSortedFiles(paths.dailyDir)
}

export function listWeeklyKeys(paths: MemoryPaths): string[] {
  return listSortedFiles(paths.weeklyDir)
}

export async function pruneOldestDaily(
  paths: MemoryPaths,
  distiller: MemorizeDistiller,
  dailyKey: string,
): Promise<void> {
  const content = readDailyFile(paths, dailyKey)
  if (content !== null) {
    await foldDailyIntoWeekly(paths, distiller, dailyKey, content)
  }
  rmSync(paths.dailyFile(dailyKey))
}

export async function enforceRetention(
  paths: MemoryPaths,
  distiller: MemorizeDistiller,
): Promise<{ prunedDaily: string[]; prunedWeekly: string[] }> {
  const prunedDaily: string[] = []
  const prunedWeekly: string[] = []

  let dailyKeys = listDailyKeys(paths)
  while (dailyKeys.length > DAILY_RETENTION) {
    const oldest = dailyKeys[0]!
    await pruneOldestDaily(paths, distiller, oldest)
    prunedDaily.push(oldest)
    dailyKeys = dailyKeys.slice(1)
  }

  let weeklyKeys = listWeeklyKeys(paths)
  while (weeklyKeys.length > WEEKLY_RETENTION) {
    const oldest = weeklyKeys[0]!
    rmSync(join(paths.weeklyDir, `${oldest}.md`))
    prunedWeekly.push(oldest)
    weeklyKeys = weeklyKeys.slice(1)
  }

  return { prunedDaily, prunedWeekly }
}
