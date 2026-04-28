import {
  formatNotesForPrompt,
  type WorkingBufferNote,
} from "../proactive/index.js"
import type { ActivityFeedEntry } from "@orbyt/contracts"

export interface UpcomingCourseworkItem {
  readonly course: string
  readonly title: string
  readonly dueAt: string | null
}

export interface PlannedSessionItem {
  readonly start: string
  readonly end: string
  readonly title: string
}

export interface HeartbeatPromptInput {
  readonly heartbeatScope: string
  readonly workingBufferNotes: ReadonlyArray<WorkingBufferNote>
  readonly nowIso: string
  readonly upcomingCoursework: ReadonlyArray<UpcomingCourseworkItem>
  readonly todaysSessions: ReadonlyArray<PlannedSessionItem>
}

function formatCoursework(
  items: ReadonlyArray<UpcomingCourseworkItem>,
): string {
  if (items.length === 0) return "(no upcoming items)"
  return items
    .map((c) =>
      `- ${c.course}: ${c.title}${c.dueAt ? ` (due ${c.dueAt})` : ""}`,
    )
    .join("\n")
}

function formatSessions(items: ReadonlyArray<PlannedSessionItem>): string {
  if (items.length === 0) return "(no sessions today)"
  return items.map((s) => `- ${s.start}–${s.end} ${s.title}`).join("\n")
}

export function buildHeartbeatPrompt(input: HeartbeatPromptInput): string {
  return [
    "You are the Orbyt heartbeat. You run every 30 minutes. Your only job is to scan",
    "the student's near-term schedule and quietly flag or pre-schedule anything",
    "acute. Default behavior is silence.",
    "",
    "Reply protocol — strict. Pick exactly one of:",
    "  A. If nothing is acute, reply EXACTLY: HEARTBEAT_OK",
    "  B. If something needs the student NOW (next ~60 min), reply with one short",
    "     paragraph (≤2 sentences). No greetings, no narration of your process.",
    "",
    "Independent of A/B, you MAY append directive lines below your reply. Each on",
    "its own line, exact format. Multiple of each are allowed.",
    "",
    "  REMINDER: at=<ISO-8601 future timestamp> | <title> | <body>",
    "      Schedules a native push at that time. No further LLM call will run.",
    "      Use this for: \"15 min before a study session starts\", \"1h before an",
    "      assignment due\", \"at the moment a packed window begins\".",
    "  WB_ADD: ttl=<hours> | <free-form note text>",
    "      Plants a note for your future heartbeats to see. Use sparingly.",
    "",
    "Rules of thumb:",
    "  - Prefer REMINDER over narrative replies. A scheduled push beats a card the",
    "    user has to notice.",
    "  - Do not re-fire reminders for the same item across heartbeats — check the",
    "    working buffer for prior WB_ADD markers before re-scheduling.",
    "  - \"Acute\" means: starts/due in the next 60 min, or the student is currently",
    "    inside a scheduled study window with nothing logged.",
    "  - 7-day-out coursework is NOT acute. Leave it for the daily-insight agent.",
    "",
    `Now (ISO): ${input.nowIso}`,
    "",
    "<heartbeat_scope>",
    input.heartbeatScope.trim().length > 0
      ? input.heartbeatScope
      : "(scope file is empty — surface only urgent items)",
    "</heartbeat_scope>",
    "",
    "<upcoming_coursework window=7d>",
    formatCoursework(input.upcomingCoursework),
    "</upcoming_coursework>",
    "",
    "<todays_sessions>",
    formatSessions(input.todaysSessions),
    "</todays_sessions>",
    "",
    "<working_buffer>",
    formatNotesForPrompt(input.workingBufferNotes),
    "</working_buffer>",
  ].join("\n")
}

const WB_ADD_PATTERN = /^WB_ADD:\s*ttl=(\d+(?:\.\d+)?)\s*\|\s*(.+)$/

export interface ParsedAgentDirectives {
  readonly cleanedReply: string
  readonly notes: ReadonlyArray<{ ttlHours: number; text: string }>
  readonly reminders: ReadonlyArray<ParsedReminderDirective>
}

/**
 * Strips WB_ADD: and REMINDER: lines from the agent's reply and extracts them
 * as structured directives.
 */
export function parseAgentDirectives(reply: string): ParsedAgentDirectives {
  const lines = reply.split(/\r?\n/)
  const kept: string[] = []
  const notes: { ttlHours: number; text: string }[] = []
  const reminders: ParsedReminderDirective[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    const wbMatch = WB_ADD_PATTERN.exec(trimmed)
    if (wbMatch) {
      const ttl = Number.parseFloat(wbMatch[1] ?? "")
      const text = (wbMatch[2] ?? "").trim()
      if (Number.isFinite(ttl) && ttl > 0 && text.length > 0) {
        notes.push({ ttlHours: ttl, text })
        continue
      }
    }
    const remMatch = REMINDER_PATTERN.exec(trimmed)
    if (remMatch) {
      const at = (remMatch[1] ?? "").trim()
      const title = (remMatch[2] ?? "").trim()
      const body = (remMatch[3] ?? "").trim()
      if (at && title && body && Number.isFinite(Date.parse(at))) {
        reminders.push({ at, title, body })
        continue
      }
    }
    kept.push(line)
  }
  return {
    cleanedReply: kept.join("\n").trim(),
    notes,
    reminders,
  }
}

export interface InsightHistoryEntry {
  readonly title: string
  readonly body: string
  readonly createdAt: string
  readonly actedOn: boolean | null
}

export interface DailyInsightPromptInput {
  readonly soul: string
  readonly nowIso: string
  readonly recentInsights: ReadonlyArray<InsightHistoryEntry>
  readonly upcomingCoursework: ReadonlyArray<UpcomingCourseworkItem>
  readonly todaysSessions: ReadonlyArray<PlannedSessionItem>
}

function formatInsightHistory(entries: ReadonlyArray<InsightHistoryEntry>): string {
  if (entries.length === 0) return "(no recent insights)"
  return entries
    .map((e) => {
      const status = e.actedOn === true
        ? "ACTED"
        : e.actedOn === false
          ? "DISMISSED"
          : "PENDING"
      return `- [${e.createdAt}] [${status}] ${e.title}: ${e.body}`
    })
    .join("\n")
}

export function buildDailyInsightPrompt(input: DailyInsightPromptInput): string {
  return [
    "You are the Orbyt daily-pulse agent. You run twice a day (8 AM and 7 PM).",
    "Your goal: produce 1–3 short, actionable insights for the student. Schedule-density problems matter most — flag packed days and propose lighter rebalances.",
    "",
    "Output format (strict): one to three insights, each on its own line, of the form:",
    "  INSIGHT: <one-sentence headline> | <one-sentence body>",
    "After the insights, you may queue concrete reminders, each on its own line:",
    "  REMINDER: at=<ISO-8601 future timestamp> | <title> | <body>",
    "Multiple REMINDER lines are allowed. Reminders fire as native notifications later, with no further LLM call.",
    "",
    `Now (ISO): ${input.nowIso}`,
    "",
    "Do NOT re-surface insights marked DISMISSED. You may reference ACTED ones to congratulate or follow up.",
    "",
    "<student_state>",
    input.soul.trim().length > 0 ? input.soul : "(SOUL.md is empty)",
    "</student_state>",
    "",
    "<recent_insights window=7d>",
    formatInsightHistory(input.recentInsights),
    "</recent_insights>",
    "",
    "<upcoming_coursework>",
    formatCoursework(input.upcomingCoursework),
    "</upcoming_coursework>",
    "",
    "<todays_sessions>",
    formatSessions(input.todaysSessions),
    "</todays_sessions>",
  ].join("\n")
}

const REMINDER_PATTERN =
  /^REMINDER:\s*at=([^|]+)\|\s*([^|]+)\|\s*(.+)$/

const INSIGHT_PATTERN = /^INSIGHT:\s*([^|]+)\|\s*(.+)$/

export interface ParsedInsight {
  readonly title: string
  readonly body: string
}

export interface ParsedReminderDirective {
  readonly at: string
  readonly title: string
  readonly body: string
}

export interface ParsedInsightOutput {
  readonly insights: ReadonlyArray<ParsedInsight>
  readonly reminders: ReadonlyArray<ParsedReminderDirective>
}

/** Parses insight + reminder lines out of the daily-insight reply. */
export function parseInsightOutput(reply: string): ParsedInsightOutput {
  const insights: ParsedInsight[] = []
  const reminders: ParsedReminderDirective[] = []
  for (const rawLine of reply.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.length === 0) continue
    const insightMatch = INSIGHT_PATTERN.exec(line)
    if (insightMatch) {
      const title = (insightMatch[1] ?? "").trim()
      const body = (insightMatch[2] ?? "").trim()
      if (title && body) insights.push({ title, body })
      continue
    }
    const reminderMatch = REMINDER_PATTERN.exec(line)
    if (reminderMatch) {
      const at = (reminderMatch[1] ?? "").trim()
      const title = (reminderMatch[2] ?? "").trim()
      const body = (reminderMatch[3] ?? "").trim()
      if (at && title && body && Number.isFinite(Date.parse(at))) {
        reminders.push({ at, title, body })
      }
    }
  }
  return { insights, reminders }
}

const HEARTBEAT_OK = "HEARTBEAT_OK"

export interface HeartbeatAckCheck {
  readonly suppress: boolean
  readonly remainder: string
}

/**
 * If the agent reply starts or ends with `HEARTBEAT_OK` and the remaining
 * text is short (≤300 chars), treat it as a "no alert needed" ack. The
 * scheduler should still record the run, but delivery should not surface it.
 */
export function checkHeartbeatAck(reply: string): HeartbeatAckCheck {
  const trimmed = reply.trim()
  if (!trimmed.includes(HEARTBEAT_OK)) {
    return { suppress: false, remainder: trimmed }
  }
  const remainder = trimmed.replace(HEARTBEAT_OK, "").trim()
  if (remainder.length <= 300) {
    return { suppress: true, remainder }
  }
  return { suppress: false, remainder }
}
