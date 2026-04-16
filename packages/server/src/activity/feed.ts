import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"
import {
  PUSH_CHANNELS,
  type ActivityFeedEntry,
  type WeeklyInsight,
} from "@student-claw/contracts"
import type { AppConfig } from "../config/defaults.js"
import type { DatabaseService } from "../db/Database.js"
import type { PushBusService } from "../ws/PushBus.js"

type ActivityEntryInput = Omit<ActivityFeedEntry, "id">

type ActivityWriterDeps = {
  readonly database: DatabaseService
  readonly pushBus: PushBusService
}

type WorkflowCompletionTurn = {
  readonly id: string
  readonly threadId: string
  readonly output: string
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
  }
}

function previewBody(output: string): string {
  const trimmed = output.trim()
  if (trimmed.length === 0) {
    return "The agent finished your requested workflow."
  }

  const normalized = trimmed.replace(/\s+/g, " ")
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177)}...`
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

  const tempDir = mkdtempSync(path.join(tmpdir(), "student-claw-weekly-insight-"))
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

function loadRecentActivityEntries(database: DatabaseService, now: Date): ReadonlyArray<ActivityFeedRow> {
  const since = new Date(now)
  since.setDate(since.getDate() - 7)

  return database.query<ActivityFeedRow>(
    `SELECT id, category, type, title, body, priority, deep_link, created_at
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
       id, category, type, title, body, priority, deep_link, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nextEntry.id,
      nextEntry.category,
      nextEntry.type,
      nextEntry.title,
      nextEntry.body ?? null,
      nextEntry.priority ?? null,
      nextEntry.deepLink ?? null,
      createdAt,
    ],
  )

  await pushBus.publish(PUSH_CHANNELS.ACTIVITY_FEED, nextEntry)
  return nextEntry
}

export async function recordWorkflowCompletionActivity({
  database,
  pushBus,
  turn,
}: ActivityWriterDeps & {
  readonly turn: WorkflowCompletionTurn
}): Promise<ActivityFeedEntry> {
  return recordActivityEntry({
    database,
    pushBus,
    entry: {
      category: "workflow",
      type: "workflow_completed",
      title: "Workflow complete",
      body: previewBody(turn.output),
      priority: 3,
      deepLink: "/chat",
    },
  })
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
