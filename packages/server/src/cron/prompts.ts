import {
  formatNotesForPrompt,
  type WorkingBufferNote,
} from "../proactive/index.js"
import type { HeartbeatCandidate } from "./heartbeat-candidates.js"
import type {
  RecapContext,
  UpcomingCourseworkRecord,
} from "./insight-context.js"
import type {
  EveningInsightPayload,
  MorningInsightPayload,
} from "@orbyt/contracts"
import type {
  EveningMode,
  EveningRecapItemSeed,
  MorningMode,
} from "./insight-mode.js"
import { simplifyCourseCode } from "./course-code.js"

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
  readonly candidates: ReadonlyArray<HeartbeatCandidate>
  readonly todaysSessions: ReadonlyArray<PlannedSessionItem>
}

function formatSessions(items: ReadonlyArray<PlannedSessionItem>): string {
  if (items.length === 0) return "(no sessions today)"
  return items.map((s) => `- ${s.start}–${s.end} ${s.title}`).join("\n")
}

function describeCandidate(c: HeartbeatCandidate): string {
  const kindLabel =
    c.kind === "instant_overdue"
      ? "OVERDUE"
      : c.kind === "instant_imminent"
        ? "IMMINENT"
        : "UPCOMING"
  const courseClean = simplifyCourseCode(c.course)
  return [
    `- [${kindLabel}] ${courseClean} ${c.title}`,
    `  type=${c.assignmentType} due=${c.dueAt} (${c.minutesUntil >= 0 ? "in" : "overdue"} ${Math.abs(Math.round(c.minutesUntil))} min)`,
  ].join("\n")
}

export function buildHeartbeatPrompt(input: HeartbeatPromptInput): string {
  const candidatesBlock =
    input.candidates.length === 0
      ? "(nothing on fire this tick. reply SKIP.)"
      : input.candidates.map(describeCandidate).join("\n")

  return [
    "you are orby. you text the student like a close friend would when stuff",
    "is piling up. one text per tick. consolidate everything below into a",
    "single message.",
    "",
    "voice rules (strict):",
    "  lowercase by default. no exceptions for proper nouns or course codes.",
    "  use ALL CAPS only for genuinely urgent stuff:",
    "    an exam or quiz starting in under 15 minutes",
    "    work due in under 30 minutes",
    "    something already overdue",
    "  no emoji. ever. anywhere. not even one.",
    "  no dashes. no em dashes. only periods, commas, and question marks.",
    "  no semicolons. no colons (other than after the DIGEST: marker).",
    "  no exclamation points unless something is genuinely urgent.",
    "  1 to 3 short sentences total. real text length. not a paragraph.",
    "  talk TO them, not at them. you are their friend, not a system.",
    "  do not say 'orby' in the body. they already know it is from you.",
    "",
    "what to write:",
    "  if there is one urgent item, lead with it in caps. then mention the",
    "  rest in lowercase as a quick aside.",
    "  if multiple things are urgent, lead with the most time critical one",
    "  in caps. summarize the rest after.",
    "  if nothing is urgent, just give a chill heads up about what is coming.",
    "  do not list every item with bullets. fold them into natural sentences.",
    "  do not narrate ('here is what is happening today'). just say it.",
    "",
    "good examples (match this energy):",
    "  DIGEST: BRO CHEM exam in 2 hrs. also a phys prelab due tonight, plus cs38 lab 4 and quiz 3 still floating. take the exam first.",
    "  DIGEST: cs38 lab 4 due in 25 min. PULL IT UP. phys prelab can wait til tonight.",
    "  DIGEST: nothing urgent. cs38 quiz coming up in a few hours and a chem reading still open. easy day.",
    "",
    "bad examples (do not write like this):",
    "  DIGEST: Heads up — you have a chem exam in 2 hours.   (capitalized, em dash)",
    "  DIGEST: orby here! you got an exam, a prelab, and 2 cs things 🚀   (says orby, emoji, exclam)",
    "  DIGEST: 1. chem exam 2hr 2. phys prelab tonight 3. cs38 lab   (bullet list, not a text)",
    "",
    "reply protocol (strict). exactly one of:",
    "  SKIP",
    "    when nothing below is worth a notification right now (everything is",
    "    already covered in <working_buffer>, or the candidates do not warrant",
    "    interruption).",
    "  DIGEST: <body>",
    "    one notification body. follow the voice rules above. no preamble,",
    "    no quoting, no labels, no extra lines after.",
    "",
    "any other output is treated as SKIP and the student gets nothing this tick.",
    "",
    `now (ISO): ${input.nowIso}`,
    "",
    "<heartbeat_scope>",
    input.heartbeatScope.trim().length > 0
      ? input.heartbeatScope
      : "(scope file is empty)",
    "</heartbeat_scope>",
    "",
    "<candidates>",
    candidatesBlock,
    "</candidates>",
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
const REMINDER_PATTERN = /^REMINDER:\s*at=([^|]+)\|\s*([^|]+)\|\s*(.+)$/

export interface ParsedAgentDirectives {
  readonly cleanedReply: string
  readonly notes: ReadonlyArray<{ ttlHours: number; text: string }>
  readonly reminders: ReadonlyArray<ParsedReminderDirective>
}

/**
 * Strips WB_ADD: and REMINDER: lines from the agent's reply and extracts them
 * as structured directives. Used by daily-insight (for legacy REMINDER + WB_ADD
 * directives). Heartbeat now uses parseHeartbeatProtocol instead.
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

export type InsightSlot = "morning" | "evening"

export interface DailyInsightPromptInput {
  readonly soul: string
  readonly nowIso: string
  readonly slot: InsightSlot
  readonly recentInsights: ReadonlyArray<InsightHistoryEntry>
  readonly upcomingCoursework: ReadonlyArray<UpcomingCourseworkRecord>
  readonly todaysSessions: ReadonlyArray<PlannedSessionItem>
  readonly recap: RecapContext
}

function formatInsightHistory(entries: ReadonlyArray<InsightHistoryEntry>): string {
  if (entries.length === 0) return "(no recent insights)"
  return entries
    .map((e) => {
      const status =
        e.actedOn === true
          ? "ACTED"
          : e.actedOn === false
            ? "DISMISSED"
            : "PENDING"
      return `- [${e.createdAt}] [${status}] ${e.title}: ${e.body}`
    })
    .join("\n")
}

function formatPriorityCoursework(
  items: ReadonlyArray<UpcomingCourseworkRecord>,
): string {
  if (items.length === 0) return "(no upcoming items in the next 7 days)"
  return items
    .map(
      (c) =>
        `- [${c.assignmentType}] ${c.course}: ${c.title}${c.dueAt ? ` (due ${c.dueAt})` : ""}${c.htmlUrl ? ` [link=${c.htmlUrl}]` : ""}`,
    )
    .join("\n")
}

function formatRecap(recap: RecapContext): string {
  const lines: string[] = []
  if (recap.completedSessions.length > 0) {
    lines.push("Sessions worked today:")
    for (const s of recap.completedSessions) {
      lines.push(`- ${s.start}–${s.end} ${s.title}`)
    }
  }
  if (recap.actedNotifications.length > 0) {
    lines.push(`Notifications acted on today: ${recap.actedNotifications.length}`)
    for (const n of recap.actedNotifications.slice(0, 6)) {
      lines.push(`- [${n.category}] ${n.title}`)
    }
  }
  if (recap.submissionsToday.length > 0) {
    lines.push("Items submitted/graded today:")
    for (const s of recap.submissionsToday) {
      lines.push(`- ${s.course}: ${s.title}`)
    }
  }
  if (lines.length === 0) return "(nothing logged today yet)"
  return lines.join("\n")
}

const EVENING_SLOT_GUIDANCE = [
  "Slot: EVENING (19:00). Frame the card around RECAP + TOMORROW:",
  "  - Open with a concrete recap line ('You logged 90min on PS6, submitted Lab 4').",
  "  - End the recap with a short genuine encouragement so the student feels",
  "    fulfilled by the day's work (e.g. 'nice momentum', 'great pace').",
  "  - Then surface tomorrow's most important assessment or work item with",
  "    a prep prompt (e.g. '30min review tonight covers chap 5–7').",
].join("\n")

/**
 * Legacy daily-insight prompt — used by the EVENING slot until that slot is
 * redesigned, and as a fallback if the morning structured parser fails. The
 * morning slot now uses buildMorningBriefingPrompt instead.
 */
export function buildDailyInsightPrompt(input: DailyInsightPromptInput): string {
  return [
    "You are Orby — Orbyt's daily-pulse mascot. You run twice a day (08:00 and 19:00).",
    "Produce ONE rich insight card. Never empty: even on quiet days, write a",
    "supportive rest message with the furthest-out important item as a heads-up.",
    "NEVER use emoji anywhere — not in headlines, body lines, or markers.",
    "",
    EVENING_SLOT_GUIDANCE,
    "",
    "OUTPUT FORMAT — strict. Emit exactly one INSIGHT line, then optional",
    "REMINDER lines. The body is multi-line: separate sections with \\n.",
    "",
    "  INSIGHT: <one-line headline (≤70 chars)> | <multi-line body>",
    "  REMINDER: at=<ISO-8601 future timestamp> | <title> | <body>",
    "",
    "BODY STRUCTURE (use \\n between lines, max 4 lines total):",
    "  1. Recap line (evening only) OR a single energizing one-liner.",
    "  2-4. Up to 3 prioritized items, one per line. Use a short word marker",
    "       like \"Heads up:\", \"Due:\", \"Next:\". Each line:",
    "       <marker> <course> <item> due <when> — <one-clause guidance>",
    "",
    "PRIORITIZATION (7-day horizon, hard cap of 3 items in body):",
    "  1. ASSESSMENTS (quiz/exam/test/midterm/finals) within 7 days, sorted by",
    "     proximity — always shown first.",
    "  2. WORK (homework/lab/project/report/paper) due within 3 days.",
    "  3. WORK due 4–7 days out, only if room remains.",
    "  4. PASSIVE items (reading/discussion) only if categories 1-3 are empty.",
    "",
    "  Hard cap: 3 items in the body. Drop the rest silently.",
    "",
    "QUIET-DAY FALLBACK (no upcoming items, no sessions, no submissions):",
    "  Write a calm, encouraging body. Mention rest. Surface the FURTHEST-out",
    "  important item from `<upcoming_coursework>` (last entry) as a heads-up.",
    "  Never produce an empty body.",
    "",
    "RULES:",
    "  - Headline is concrete, not vague. \"Calc midterm in 2 days\" not \"Insight\".",
    "  - NO emoji anywhere.",
    "  - Do NOT re-surface insights marked DISMISSED in <recent_insights>.",
    "  - You may reference ACTED ones to congratulate.",
    "  - REMINDER lines are optional; use them sparingly for time-sensitive prep.",
    "    REMINDER body MUST be in Orby's gen z texting voice (lowercase by",
    "    default, ALL CAPS only for genuinely urgent items, no emoji, no",
    "    dashes, no em dashes, 1 short sentence). The insight card above can",
    "    keep its analytical tone, but the reminder body itself is a future",
    "    text from a friend. Example: \"REMINDER: at=2026-04-30T21:00:00Z |",
    "    calc review | yo, 30min on calc ch 5 to 7 right now sets up thursday\".",
    "",
    `Now (ISO): ${input.nowIso}`,
    "",
    "<student_state>",
    input.soul.trim().length > 0 ? input.soul : "(SOUL.md is empty)",
    "</student_state>",
    "",
    "<recap_today>",
    formatRecap(input.recap),
    "</recap_today>",
    "",
    "<recent_insights window=7d>",
    formatInsightHistory(input.recentInsights),
    "</recent_insights>",
    "",
    "<upcoming_coursework window=7d>",
    formatPriorityCoursework(input.upcomingCoursework),
    "</upcoming_coursework>",
    "",
    "<todays_sessions>",
    formatSessions(input.todaysSessions),
    "</todays_sessions>",
  ].join("\n")
}

export interface MorningBriefingPromptInput
  extends DailyInsightPromptInput {
  readonly mode: MorningMode
  readonly mustDoToday: ReadonlyArray<UpcomingCourseworkRecord>
}

function formatMustDoToday(
  items: ReadonlyArray<UpcomingCourseworkRecord>,
): string {
  if (items.length === 0) return "(nothing due today)"
  return items
    .map(
      (it) =>
        `- ${it.course} | ${it.title} | due=${it.dueAt ?? "today"} | type=${it.assignmentType}${it.htmlUrl ? ` | link=${it.htmlUrl}` : ""}`,
    )
    .join("\n")
}

const MORNING_BRIEFING_GUIDANCE = [
  "MODE: BRIEFING — emit a four-component morning daily briefing card.",
  "",
  "Your job: synthesize the data into an assistant-style briefing the student",
  "would actually want from a chief-of-staff. The lever is the actual insight",
  "— the strategic move-of-the-day — and is the only freeform slot. Everything",
  "else is data-driven.",
  "",
  "REQUIRED FIELDS:",
  "  headline  ≤70 chars. Concrete. Not vague. Used as the OS-notification",
  "            preview. Examples: \"Calc midterm in 2 days, Lab due tonight\",",
  "            \"Quiet morning, but PHYS quiz Thursday\".",
  "  anchor    1 line. Date + class count + planned-block count. Example:",
  "            \"Tuesday, Apr 30 — 3 classes, 2 study blocks planned\".",
  "            Read the day-of-week / month / day from `Now (ISO)`.",
  "  mustDo    Array (0–N). Items literally due today, copied from",
  "            <must_do_today> below. Preserve course, title, dueTime (ISO,",
  "            or null if unknown), and deepLink (or null). Empty array is OK.",
  "  lever     1–2 sentences. THE STRATEGIC MOVE OF THE DAY. Synthesize from:",
  "            (a) what's coming up in the next 3–7 days,",
  "            (b) what blocks are open today (<todays_sessions>),",
  "            (c) what insights the student ACTED on or DISMISSED recently",
  "                (<recent_insights>) — never re-surface DISMISSED items.",
  "            Examples:",
  "              \"Best move today is the Calc Ch 5 review — midterm's Thursday",
  "               and you've shrugged off two reminders about it. Your 19:00",
  "               block is wide open.\"",
  "              \"Lab 8 is the soft middle. PHYS quiz Thursday is the hard one.",
  "               Don't lose the morning to the lab — it's a 90-min job, not 3hr.\"",
  "  horizon   1 line OR null. Biggest thing later this week. Frame so today's",
  "            choices make sense. Example: \"Big rock this week: PHYS midterm",
  "            Thursday\". Use null when nothing notable in the 7-day window.",
  "",
  "VOICE — Orby. Warm, mildly cheeky, present-tense, talks TO the student.",
  "Never preachy. Encouragement is allowed only INSIDE the lever sentence —",
  "no separate \"you got this\" beats.",
  "",
  "ABSOLUTE RULES:",
  "  - NEVER use emoji. Anywhere. Not in headline, anchor, lever, horizon, or",
  "    inside mustDo strings. Use words, not glyphs.",
  "  - Do NOT echo DISMISSED insights from <recent_insights>.",
  "  - Do NOT pad the lever with platitudes (\"you got this\", \"believe\").",
  "  - Do NOT include quotes from famous people.",
].join("\n")

const MORNING_QUIET_GUIDANCE = [
  "MODE: QUIET — emit a minimal quiet-day card. The day has nothing anchor-",
  "worthy: no items due today, no planned blocks, nothing notable in 48h.",
  "",
  "REQUIRED FIELDS:",
  "  headline    ≤70 chars. Calm tone. Examples: \"Quiet morning, breathing",
  "              room is yours\", \"Easy day on paper — nothing on fire\".",
  "  lever       1–2 sentences. Pick ONE of:",
  "              (a) REFLECTIVE — draw on <recent_insights> ACTED/DISMISSED",
  "                  data and <recap_today> to surface a real pattern.",
  "                  Example: \"You closed PS6 and Lab 4 this week — both",
  "                  you'd been dragging. What unblocked them? Worth knowing",
  "                  for next week's calc push.\"",
  "              (b) SEED — point softly at the next horizon item without",
  "                  nagging. Use only when there IS a horizon item visible",
  "                  in <upcoming_coursework>.",
  "                  Example: \"PHYS quiz Thursday is the next real thing.",
  "                  Today's a fine day to leave alone — but a 20min skim",
  "                  tomorrow makes Thursday easier.\"",
  "  reflection  1 line OR null. Optional follow-up question that pushes the",
  "              student to think (only when the lever is reflective).",
  "              Example: \"What's one thing from this week you'd repeat?\"",
  "",
  "VOICE — Orby, calm register. No emoji. No quotes. No standalone \"rest up,",
  "you earned it\" sentences — that energy lives inside the lever.",
].join("\n")

/**
 * Builds the morning daily-insight prompt. The prompt branches on `mode`:
 * BRIEFING produces the full four-component card; QUIET produces the minimal
 * card. Output is a single JSON object on one line, prefixed `INSIGHT_JSON:`.
 */
export function buildMorningBriefingPrompt(
  input: MorningBriefingPromptInput,
): string {
  const guidance =
    input.mode === "briefing"
      ? MORNING_BRIEFING_GUIDANCE
      : MORNING_QUIET_GUIDANCE

  const exampleObject =
    input.mode === "briefing"
      ? `{"slot":"morning","mode":"briefing","headline":"Calc midterm in 3 days, Lab due tonight","anchor":"Tuesday, Apr 30 — 3 classes, 2 study blocks planned","mustDo":[{"course":"CS38","title":"CW Array1","dueTime":"2026-04-30T23:59:00Z","deepLink":"https://canvas..."}],"lever":"Best move today is 45min on Calc Ch 5 — midterm's Thursday and you've dismissed two reminders about it. Your 19:00 block is wide open.","horizon":"Big rock this week: PHYS midterm Thursday"}`
      : `{"slot":"morning","mode":"quiet","headline":"Quiet morning, breathing room is yours","lever":"You closed PS6 and Lab 4 this week — both you'd been dragging. Worth knowing how you unblocked them before next week's calc push.","reflection":"What's one thing from this week you'd repeat?"}`

  return [
    "You are Orby — Orbyt's morning briefing assistant. The student just woke",
    "up. Your job is ONE structured insight card.",
    "",
    guidance,
    "",
    "OUTPUT FORMAT — strict. Emit exactly one line:",
    "",
    "  INSIGHT_JSON: <single-line JSON object matching the mode's schema>",
    "",
    "Then optionally one or more REMINDER lines for time-sensitive prep:",
    "  REMINDER: at=<ISO-8601 future timestamp> | <title> | <body>",
    "",
    "REMINDER body must be in Orby's gen z texting voice: lowercase by default,",
    "ALL CAPS only for genuinely urgent items, no emoji, no dashes, no em dashes,",
    "1 short sentence. The insight JSON above keeps its briefing tone, but the",
    "reminder body itself is a future text from a friend.",
    "",
    "Output ONLY those lines. No markdown fences. No commentary. No preamble.",
    "Malformed JSON triggers a deterministic fallback.",
    "",
    `EXAMPLE (this mode):  INSIGHT_JSON: ${exampleObject}`,
    "",
    `Now (ISO): ${input.nowIso}`,
    `Mode: ${input.mode}`,
    "",
    "<student_state>",
    input.soul.trim().length > 0 ? input.soul : "(SOUL.md is empty)",
    "</student_state>",
    "",
    "<must_do_today>",
    formatMustDoToday(input.mustDoToday),
    "</must_do_today>",
    "",
    "<todays_sessions>",
    formatSessions(input.todaysSessions),
    "</todays_sessions>",
    "",
    "<recap_today>",
    formatRecap(input.recap),
    "</recap_today>",
    "",
    "<recent_insights window=7d>",
    formatInsightHistory(input.recentInsights),
    "</recent_insights>",
    "",
    "<upcoming_coursework window=7d>",
    formatPriorityCoursework(input.upcomingCoursework),
    "</upcoming_coursework>",
  ].join("\n")
}

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

const INSIGHT_PATTERN = /^INSIGHT:\s*([^|]+)\|\s*([\s\S]+)$/

/** Parses INSIGHT and REMINDER lines out of a daily-insight reply (legacy). */
export function parseInsightOutput(reply: string): ParsedInsightOutput {
  const insights: ParsedInsight[] = []
  const reminders: ParsedReminderDirective[] = []

  // First pass: extract REMINDER lines. They never contain newlines.
  const remainingLines: string[] = []
  for (const rawLine of reply.split(/\r?\n/)) {
    const line = rawLine.trim()
    const reminderMatch = REMINDER_PATTERN.exec(line)
    if (reminderMatch) {
      const at = (reminderMatch[1] ?? "").trim()
      const title = (reminderMatch[2] ?? "").trim()
      const body = (reminderMatch[3] ?? "").trim()
      if (at && title && body && Number.isFinite(Date.parse(at))) {
        reminders.push({ at, title, body })
        continue
      }
    }
    remainingLines.push(rawLine)
  }

  // Second pass: an INSIGHT line may start a multi-line body (joined with \n).
  const remainder = remainingLines.join("\n")
  const insightStart = remainder.search(/^INSIGHT:/m)
  if (insightStart !== -1) {
    const slice = remainder.slice(insightStart)
    const match = INSIGHT_PATTERN.exec(slice)
    if (match) {
      const title = (match[1] ?? "").trim()
      const body = (match[2] ?? "").trim()
      if (title && body) insights.push({ title, body })
    }
  }

  return { insights, reminders }
}

const INSIGHT_JSON_PATTERN = /^INSIGHT_JSON:\s*(\{[\s\S]*?\})\s*$/m

const EMOJI_PATTERN =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2700}-\u{27BF}]/gu

/**
 * Defense-in-depth: strip emoji from any string we got back from the model.
 * The prompt forbids emoji explicitly, but models occasionally hallucinate
 * one. Stripping at the parser keeps the no-emoji rule intact even when the
 * model slips. Collapses any double spaces created by the strip.
 */
function stripEmoji(s: string): string {
  return s.replace(EMOJI_PATTERN, "").replace(/\s{2,}/g, " ").trim()
}

export interface ParsedMorningInsight {
  readonly payload: MorningInsightPayload | null
  readonly reminders: ReadonlyArray<ParsedReminderDirective>
}

interface RawMorningJson {
  slot?: unknown
  mode?: unknown
  headline?: unknown
  anchor?: unknown
  mustDo?: unknown
  lever?: unknown
  horizon?: unknown
  reflection?: unknown
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? stripEmoji(v) : null
}

function asNullableString(v: unknown): string | null {
  if (v === null || v === undefined) return null
  return typeof v === "string" ? stripEmoji(v) : null
}

interface MustDoItemShape {
  readonly course: string
  readonly title: string
  readonly dueTime: string | null
  readonly deepLink: string | null
}

function parseMustDoArray(v: unknown): ReadonlyArray<MustDoItemShape> {
  if (!Array.isArray(v)) return []
  const out: MustDoItemShape[] = []
  for (const item of v) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    const course = asString(rec.course)
    const title = asString(rec.title)
    if (course === null || title === null) continue
    out.push({
      course,
      title,
      dueTime: asNullableString(rec.dueTime),
      deepLink: asNullableString(rec.deepLink),
    })
  }
  return out
}

function buildMorningPayload(raw: RawMorningJson): MorningInsightPayload | null {
  // Tolerate missing slot from older prompts; default to "morning".
  if (raw.slot !== undefined && raw.slot !== "morning") return null
  const mode = raw.mode
  const headline = asString(raw.headline)
  const lever = asString(raw.lever)
  if (headline === null || lever === null) return null

  if (mode === "briefing") {
    const anchor = asString(raw.anchor)
    if (anchor === null) return null
    return {
      slot: "morning",
      mode: "briefing",
      headline,
      anchor,
      mustDo: parseMustDoArray(raw.mustDo),
      lever,
      horizon: asNullableString(raw.horizon),
    }
  }

  if (mode === "quiet") {
    return {
      slot: "morning",
      mode: "quiet",
      headline,
      lever,
      reflection: asNullableString(raw.reflection),
    }
  }

  return null
}

/**
 * Parses the morning briefing reply. Looks for a single `INSIGHT_JSON:` line
 * carrying a JSON object, validates the shape into a typed payload, and
 * extracts any sibling REMINDER lines. On any structural failure returns
 * `payload: null` so the executor can fall back to the legacy parser or to
 * the deterministic fallback insight.
 */
export function parseMorningInsight(reply: string): ParsedMorningInsight {
  const reminders: ParsedReminderDirective[] = []
  for (const rawLine of reply.split(/\r?\n/)) {
    const line = rawLine.trim()
    const reminderMatch = REMINDER_PATTERN.exec(line)
    if (!reminderMatch) continue
    const at = (reminderMatch[1] ?? "").trim()
    const title = (reminderMatch[2] ?? "").trim()
    const body = (reminderMatch[3] ?? "").trim()
    if (at && title && body && Number.isFinite(Date.parse(at))) {
      reminders.push({ at, title: stripEmoji(title), body: stripEmoji(body) })
    }
  }

  const jsonMatch = INSIGHT_JSON_PATTERN.exec(reply)
  if (!jsonMatch) return { payload: null, reminders }

  const jsonText = jsonMatch[1] ?? ""
  let raw: RawMorningJson
  try {
    raw = JSON.parse(jsonText) as RawMorningJson
  } catch {
    return { payload: null, reminders }
  }

  const payload = buildMorningPayload(raw)
  return { payload, reminders }
}

// ---------------------------------------------------------------------------
// Evening briefing
// ---------------------------------------------------------------------------

export interface EveningBriefingPromptInput
  extends DailyInsightPromptInput {
  readonly mode: EveningMode
  readonly recapItems: ReadonlyArray<EveningRecapItemSeed>
}

function formatRecapSeeds(
  items: ReadonlyArray<EveningRecapItemSeed>,
): string {
  if (items.length === 0) return "(nothing logged today)"
  return items
    .map(
      (it) =>
        `- kind=${it.kind} | course=${it.course ?? "(none)"} | label=${it.label}`,
    )
    .join("\n")
}

const EVENING_BRIEFING_GUIDANCE = [
  "MODE: BRIEFING — emit the four-component evening wind-down briefing.",
  "",
  "Your job: synthesize the day into an analytical, warm wind-down. The",
  "throughline is the actual *insight* — a cross-temporal pattern across the",
  "7-day window, surfaced through today's lens. Not strategy, not a to-do.",
  "",
  "REQUIRED FIELDS:",
  "  headline   ≤70 chars. Concrete and grounded in the day or the week.",
  "             Examples:",
  "               \"Solid grind: 2 sessions, Lab 4 shipped\"",
  "               \"Quiet on paper, but the AM pattern is loud\"",
  "  recap.summary    1 short sentence in Orby's voice synthesizing the day.",
  "                   Mention what the student actually did, not just counts.",
  "                   Example: \"You stuck the Calc landing and got Lab 4 out\"",
  "                   the door, plus three reminder hits acted on.\"",
  "  recap.items      Pass through the chips from <recap_items> below verbatim",
  "                   into the JSON array (preserve kind/course/label).",
  "  throughline      1–2 sentences. CROSS-TEMPORAL pattern across the 7-day",
  "                   window — what does today fit into? Examples:",
  "                     \"Three of your last four shipped items were morning",
  "                      sessions. Whatever you're doing in the AM is the",
  "                      thing — keep it.\"",
  "                     \"Second straight evening you skipped the Calc review.",
  "                      Not nagging — just naming the pattern.\"",
  "                   Pull from <recent_insights> ACTED/DISMISSED status,",
  "                   <recap_today>, and any cross-day signal you can read.",
  "                   Avoid pure recap (already in the recap field) and avoid",
  "                   pure forward strategy (that's morning's lever).",
  "  tomorrow         1 line. SOFT FRAMING ONLY — no action list, no to-do.",
  "                   Set expectations for the day ahead. Examples:",
  "                     \"Tomorrow leans heavy: Calc midterm and the lab return.\"",
  "                     \"Tomorrow's light on paper, mostly classwork.\"",
  "                   Pull from <upcoming_coursework>.",
  "  windDown   1 line OR null. Optional closure beat. Emit ONLY when the day",
  "             actually warrants closure — heavy logged work, late hour, or",
  "             nothing on fire tomorrow. NULL on light or chaotic days. Do",
  "             not pad with \"rest up\" generics. Example:",
  "               \"Brain can let go now — the heavy lifting is filed.\"",
  "",
  "VOICE — Orby. Same warmth as the morning briefing. Full sentences with",
  "proper caps. Mildly cheeky is welcome inside the recap summary or wind-down,",
  "but the throughline stays observational and clean — it earns its slot by",
  "being the line a student would re-read.",
  "",
  "ABSOLUTE RULES:",
  "  - NEVER use emoji anywhere.",
  "  - The throughline is NOT a forward strategy line — that's the morning's",
  "    job. If you catch yourself writing \"best move tomorrow is...\", stop.",
  "  - Do not echo DISMISSED insights from <recent_insights>.",
  "  - Do not add platitudes (\"you got this\", \"believe in yourself\").",
  "  - No quotes from famous people.",
].join("\n")

const EVENING_QUIET_GUIDANCE = [
  "MODE: QUIET — emit a minimal quiet evening card. Today logged nothing AND",
  "tomorrow has nothing pressing within 24h. The week-pattern throughline",
  "still earns its keep — quiet evenings are the best moment for it.",
  "",
  "REQUIRED FIELDS:",
  "  headline    ≤70 chars. Calm, observational. Examples:",
  "                \"Quiet evening — the week pattern is louder\"",
  "                \"Easy day on paper. Worth a small look-back.\"",
  "  throughline 1–2 sentences. Cross-temporal pattern across the 7-day",
  "              window — exactly the same shape as the briefing's",
  "              throughline. Use the quiet to make the observation land.",
  "  reflection  1 line OR null. Optional follow-up question that pushes the",
  "              student to think. Example: \"What's one thing from this",
  "              week you'd repeat?\"",
  "",
  "VOICE — Orby, calm register. Same rules: no emoji, no quotes, no",
  "standalone \"rest up\" beats.",
].join("\n")

/**
 * Builds the evening daily-insight prompt. The prompt branches on `mode`:
 * BRIEFING produces the four-component card; QUIET produces the minimal
 * card. Output is a single JSON object on one line, prefixed `INSIGHT_JSON:`.
 */
export function buildEveningBriefingPrompt(
  input: EveningBriefingPromptInput,
): string {
  const guidance =
    input.mode === "briefing"
      ? EVENING_BRIEFING_GUIDANCE
      : EVENING_QUIET_GUIDANCE

  const exampleObject =
    input.mode === "briefing"
      ? `{"slot":"evening","mode":"briefing","headline":"Solid grind: 2 sessions, Lab 4 shipped","recap":{"summary":"You stuck the Calc landing and got Lab 4 out the door.","items":[{"kind":"session","course":"CALC","label":"2hr Calc PS6"},{"kind":"submission","course":"CHEM230","label":"Lab 4 report"},{"kind":"acted_summary","course":null,"label":"3 reminders acted"}]},"throughline":"Three of your last four shipped items were morning sessions. Whatever you're doing in the AM is the thing — keep it.","tomorrow":"Tomorrow leans heavy: Calc midterm and the lab return.","windDown":"Brain can let go now — the heavy lifting is filed."}`
      : `{"slot":"evening","mode":"quiet","headline":"Quiet evening — the week pattern is louder","throughline":"Three of your last four shipped items were morning sessions. Whatever you're doing in the AM is the thing — keep it.","reflection":"What's one thing from this week you'd repeat?"}`

  return [
    "You are Orby — Orbyt's evening wind-down assistant. The student is closing",
    "out their day. Your job is ONE structured insight card.",
    "",
    guidance,
    "",
    "OUTPUT FORMAT — strict. Emit exactly one line:",
    "",
    "  INSIGHT_JSON: <single-line JSON object matching the mode's schema>",
    "",
    "Then optionally one or more REMINDER lines for time-sensitive prep:",
    "  REMINDER: at=<ISO-8601 future timestamp> | <title> | <body>",
    "",
    "Output ONLY those lines. No markdown fences. No commentary. No preamble.",
    "Malformed JSON triggers a deterministic fallback.",
    "",
    `EXAMPLE (this mode):  INSIGHT_JSON: ${exampleObject}`,
    "",
    `Now (ISO): ${input.nowIso}`,
    `Mode: ${input.mode}`,
    "",
    "<student_state>",
    input.soul.trim().length > 0 ? input.soul : "(SOUL.md is empty)",
    "</student_state>",
    "",
    "<recap_today>",
    formatRecap(input.recap),
    "</recap_today>",
    "",
    "<recap_items>",
    formatRecapSeeds(input.recapItems),
    "</recap_items>",
    "",
    "<recent_insights window=7d>",
    formatInsightHistory(input.recentInsights),
    "</recent_insights>",
    "",
    "<upcoming_coursework window=7d>",
    formatPriorityCoursework(input.upcomingCoursework),
    "</upcoming_coursework>",
    "",
    "<todays_sessions>",
    formatSessions(input.todaysSessions),
    "</todays_sessions>",
  ].join("\n")
}

export interface ParsedEveningInsight {
  readonly payload: EveningInsightPayload | null
  readonly reminders: ReadonlyArray<ParsedReminderDirective>
}

interface RawEveningJson {
  slot?: unknown
  mode?: unknown
  headline?: unknown
  recap?: unknown
  throughline?: unknown
  tomorrow?: unknown
  windDown?: unknown
  reflection?: unknown
}

interface RawRecapItem {
  kind?: unknown
  course?: unknown
  label?: unknown
}

const RECAP_KINDS = new Set(["session", "submission", "acted_summary"])

function parseRecapItems(
  v: unknown,
): ReadonlyArray<{
  kind: "session" | "submission" | "acted_summary"
  course: string | null
  label: string
}> {
  if (!Array.isArray(v)) return []
  const out: Array<{
    kind: "session" | "submission" | "acted_summary"
    course: string | null
    label: string
  }> = []
  for (const item of v as ReadonlyArray<RawRecapItem>) {
    if (!item || typeof item !== "object") continue
    const kind = typeof item.kind === "string" ? item.kind : ""
    if (!RECAP_KINDS.has(kind)) continue
    const label = asString(item.label)
    if (label === null) continue
    out.push({
      kind: kind as "session" | "submission" | "acted_summary",
      course: asNullableString(item.course),
      label,
    })
  }
  return out
}

function parseRecap(v: unknown): { summary: string; items: ReadonlyArray<{
  kind: "session" | "submission" | "acted_summary"
  course: string | null
  label: string
}> } | null {
  if (!v || typeof v !== "object") return null
  const rec = v as Record<string, unknown>
  const summary = asString(rec.summary)
  if (summary === null) return null
  return { summary, items: parseRecapItems(rec.items) }
}

function buildEveningPayload(raw: RawEveningJson): EveningInsightPayload | null {
  if (raw.slot !== "evening") return null
  const mode = raw.mode
  const headline = asString(raw.headline)
  if (headline === null) return null

  if (mode === "briefing") {
    const recap = parseRecap(raw.recap)
    if (recap === null) return null
    const throughline = asString(raw.throughline)
    const tomorrow = asString(raw.tomorrow)
    if (throughline === null || tomorrow === null) return null
    return {
      slot: "evening",
      mode: "briefing",
      headline,
      recap,
      throughline,
      tomorrow,
      windDown: asNullableString(raw.windDown),
    }
  }

  if (mode === "quiet") {
    const throughline = asString(raw.throughline)
    if (throughline === null) return null
    return {
      slot: "evening",
      mode: "quiet",
      headline,
      throughline,
      reflection: asNullableString(raw.reflection),
    }
  }

  return null
}

/**
 * Parses the evening briefing reply. Same shape as parseMorningInsight: looks
 * for a single `INSIGHT_JSON:` line, validates against the evening union, and
 * extracts sibling REMINDER lines. Defensive emoji stripping inherited from
 * the shared helpers.
 */
export function parseEveningInsight(reply: string): ParsedEveningInsight {
  const reminders: ParsedReminderDirective[] = []
  for (const rawLine of reply.split(/\r?\n/)) {
    const line = rawLine.trim()
    const reminderMatch = REMINDER_PATTERN.exec(line)
    if (!reminderMatch) continue
    const at = (reminderMatch[1] ?? "").trim()
    const title = (reminderMatch[2] ?? "").trim()
    const body = (reminderMatch[3] ?? "").trim()
    if (at && title && body && Number.isFinite(Date.parse(at))) {
      reminders.push({ at, title: stripEmoji(title), body: stripEmoji(body) })
    }
  }

  const jsonMatch = INSIGHT_JSON_PATTERN.exec(reply)
  if (!jsonMatch) return { payload: null, reminders }

  const jsonText = jsonMatch[1] ?? ""
  let raw: RawEveningJson
  try {
    raw = JSON.parse(jsonText) as RawEveningJson
  } catch {
    return { payload: null, reminders }
  }

  const payload = buildEveningPayload(raw)
  return { payload, reminders }
}

const HEARTBEAT_OK = "HEARTBEAT_OK"

export interface HeartbeatAckCheck {
  readonly suppress: boolean
  readonly remainder: string
}

/**
 * Legacy ack check. Heartbeat now uses parseHeartbeatProtocol; this is kept
 * to avoid breaking callers that still inspect free-form heartbeat output.
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
