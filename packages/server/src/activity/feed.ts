import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"
import {
  PUSH_CHANNELS,
  type ActivityFeedEntry,
  type WeeklyInsight,
} from "@orbyt/contracts"
import type { AppConfig } from "../config/defaults.js"
import type { DatabaseService } from "../db/Database.js"
import type { PushBusService } from "../ws/PushBus.js"

type ActivityEntryInput = Omit<ActivityFeedEntry, "id">

type ActivityWriterDeps = {
  readonly database: DatabaseService
  readonly pushBus: PushBusService
}

type WeeklyInsightDeps = {
  readonly database: DatabaseService
  readonly config: AppConfig
  readonly now?: Date
}

type ActivityFeedRow = {
  readonly id: string
  readonly category: ActivityFeedEntry["category"]
  readonly type: string
  readonly title: string
  readonly body: string | null
  readonly priority: number | null
  readonly deep_link: string | null
  readonly notify: number | null
  readonly acted_on: number | null
  readonly acted_at: number | null
  readonly created_at: string
}

function toActivityFeedEntry(row: ActivityFeedRow): ActivityFeedEntry {
  return {
    id: row.id as ActivityFeedEntry["id"],
    category: row.category,
    type: row.type,
    title: row.title,
    ...(row.body ? { body: row.body } : {}),
    ...(row.priority === null ? {} : { priority: row.priority }),
    ...(row.deep_link ? { deepLink: row.deep_link } : {}),
    ...(row.notify === 1 ? { notify: true } : {}),
    ...(row.acted_on === null ? {} : { actedOn: row.acted_on === 1 }),
    ...(row.acted_at === null ? {} : { actedAt: row.acted_at }),
    createdAt: row.created_at,
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

export function getWeekKey(date: Date): string {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const mondayOffset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - mondayOffset)
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
}

function buildInsightPrompt(entries: ReadonlyArray<ActivityFeedRow>, now: Date): string {
  const sample = entries.slice(0, 12).map((entry) => ({
    category: entry.category,
    type: entry.type,
    title: entry.title,
    body: entry.body,
    priority: entry.priority,
    createdAt: entry.created_at,
  }))

  return [
    "Write one concise weekly productivity insight for a student desktop assistant.",
    "Return strict JSON with keys: title, body.",
    "No markdown fences. No commentary.",
    `Week key: ${getWeekKey(now)}`,
    `Reference date: ${now.toISOString()}`,
    JSON.stringify(sample),
  ].join("\n")
}

function extractJsonObject(raw: string): { title?: string; body?: string } | null {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return null
  }

  try {
    return JSON.parse(trimmed) as { title?: string; body?: string }
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) {
      return null
    }

    try {
      return JSON.parse(match[0]) as { title?: string; body?: string }
    } catch {
      return null
    }
  }
}

function tryGenerateAiWeeklyInsight(
  entries: ReadonlyArray<ActivityFeedRow>,
  config: AppConfig,
  now: Date,
): WeeklyInsight | null {
  if (entries.length === 0) {
    return null
  }

  const tempDir = mkdtempSync(path.join(tmpdir(), "orbyt-weekly-insight-"))
  const outputPath = path.join(tempDir, "weekly-insight.json")

  try {
    const prompt = buildInsightPrompt(entries, now)
    const result = spawnSync(
      config.codexBinaryPath,
      [
        "exec",
        "--skip-git-repo-check",
        "--ephemeral",
        "--sandbox",
        "read-only",
        "--output-last-message",
        outputPath,
        "-m",
        config.codexModel,
        prompt,
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ...(config.codexHomePath ? { CODEX_HOME: config.codexHomePath } : {}),
          ...(config.codexProcessHomePath ? { HOME: config.codexProcessHomePath } : {}),
        },
        encoding: "utf8",
      },
    )

    if (result.status !== 0) {
      return null
    }

    const parsed = extractJsonObject(readFileSync(outputPath, "utf8"))
    if (!parsed?.title || !parsed?.body) {
      return null
    }

    return {
      title: parsed.title.trim(),
      body: parsed.body.trim(),
      weekKey: getWeekKey(now),
    }
  } catch {
    return null
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

/**
 * Loads the most recent activity-feed entries that the user has not yet
 * dismissed or acted on, for hydrating the renderer-side activity center on
 * startup. Dismissed/acted entries are excluded so they do not reappear.
 */
export function loadActivityFeed(
  database: DatabaseService,
  limit = 100,
): ReadonlyArray<ActivityFeedEntry> {
  const rows = database.query<ActivityFeedRow>(
    `SELECT id, category, type, title, body, priority, deep_link,
            notify, acted_on, acted_at, created_at
       FROM activity_feed
      WHERE acted_on IS NULL
      ORDER BY created_at DESC
      LIMIT ?`,
    [limit],
  )
  return rows.map(toActivityFeedEntry)
}

function loadRecentActivityEntries(database: DatabaseService, now: Date): ReadonlyArray<ActivityFeedRow> {
  const since = new Date(now)
  since.setDate(since.getDate() - 7)

  return database.query<ActivityFeedRow>(
    `SELECT id, category, type, title, body, priority, deep_link,
            notify, acted_on, acted_at, created_at
     FROM activity_feed
     WHERE created_at >= ?
     ORDER BY created_at DESC`,
    [since.toISOString()],
  )
}

export function buildDeterministicWeeklyInsight(
  entries: ReadonlyArray<ActivityFeedRow>,
  now: Date,
): WeeklyInsight {
  const counts = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.category] = (acc[entry.category] ?? 0) + 1
    return acc
  }, {})
  const workflowCount = counts.workflow ?? 0
  const insightCount = counts.insight ?? 0
  const totalCount = entries.length

  const title = workflowCount > 0
    ? `Weekly insight: ${workflowCount} workflow completion${workflowCount === 1 ? "" : "s"}`
    : "Weekly insight ready"

  const body = totalCount > 0
    ? `You logged ${totalCount} activity update${totalCount === 1 ? "" : "s"} this week, including ${workflowCount} workflow completion${workflowCount === 1 ? "" : "s"} and ${insightCount} insight${insightCount === 1 ? "" : "s"}.`
    : "No activity was recorded this week yet, so this insight is ready as soon as new workflow activity arrives."

  return {
    title,
    body,
    weekKey: getWeekKey(now),
  }
}

export async function recordActivityEntry({
  database,
  pushBus,
  entry,
}: ActivityWriterDeps & {
  readonly entry: ActivityEntryInput
}): Promise<ActivityFeedEntry> {
  const nextEntry: ActivityFeedEntry = {
    id: randomUUID() as ActivityFeedEntry["id"],
    ...entry,
  }
  const createdAt = new Date().toISOString()

  database.execute(
    `INSERT INTO activity_feed (
       id, category, type, title, body, priority, deep_link, notify, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nextEntry.id,
      nextEntry.category,
      nextEntry.type,
      nextEntry.title,
      nextEntry.body ?? null,
      nextEntry.priority ?? null,
      nextEntry.deepLink ?? null,
      nextEntry.notify ? 1 : 0,
      createdAt,
    ],
  )

  await pushBus.publish(PUSH_CHANNELS.ACTIVITY_FEED, nextEntry)
  return nextEntry
}

export interface InsightHistoryRecord {
  readonly id: string
  readonly title: string
  readonly body: string
  readonly createdAt: string
  readonly actedOn: boolean | null
}

/**
 * Returns recent activity-feed rows in the `insight` category along with their
 * dismissed/acted state. Used by the daily-insight prompt so the agent can
 * avoid re-surfacing dismissed advice and follow up on acted advice.
 */
export function recentInsightsWithStatus(
  database: DatabaseService,
  windowDays = 7,
  now: Date = new Date(),
): ReadonlyArray<InsightHistoryRecord> {
  const since = new Date(now)
  since.setDate(since.getDate() - windowDays)
  const rows = database.query<{
    id: string
    title: string
    body: string | null
    created_at: string
    acted_on: number | null
  }>(
    `SELECT id, title, body, created_at, acted_on
       FROM activity_feed
      WHERE category IN ('insight', 'cron')
        AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT 32`,
    [since.toISOString()],
  )
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body ?? "",
    createdAt: row.created_at,
    actedOn: row.acted_on === null ? null : row.acted_on === 1,
  }))
}

export interface ActivityActedInput {
  readonly id: string
  readonly acted: boolean
  readonly at?: number
}

/** Records the user's action on an activity entry (dismiss / mark acted). */
export function setActivityActedOn(
  database: DatabaseService,
  input: ActivityActedInput,
): void {
  database.execute(
    `UPDATE activity_feed
        SET acted_on = ?, acted_at = ?
      WHERE id = ?`,
    [input.acted ? 1 : 0, input.at ?? Date.now(), input.id],
  )
}

export async function generateWeeklyInsight({
  database,
  config,
  now = new Date(),
}: WeeklyInsightDeps): Promise<WeeklyInsight> {
  const entries = loadRecentActivityEntries(database, now)
  return tryGenerateAiWeeklyInsight(entries, config, now)
    ?? buildDeterministicWeeklyInsight(entries, now)
}
