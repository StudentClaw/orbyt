import type {
  EveningInsightPayload,
  MorningInsightPayload,
} from "@orbyt/contracts"
import type { ParsedReminderDirective } from "./prompts.js"

const REMINDER_PATTERN = /^REMINDER:\s*at=([^|]+)\|\s*([^|]+)\|\s*(.+)$/
const INSIGHT_JSON_PATTERN = /^INSIGHT_JSON:\s*(\{[\s\S]*?\})\s*$/m

const EMOJI_PATTERN =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2700}-\u{27BF}]/gu

const DASH_PATTERN = /[‐-―−]/g

/**
 * Defense-in-depth: enforce Orby voice on model output. Strip emoji and any
 * unicode/ascii dashes (the prompt forbids em/en dashes), collapse resulting
 * double spaces. Matches the heartbeat sanitizer so behavior is consistent.
 */
function sanitizeInsightString(s: string): string {
  return s
    .replace(EMOJI_PATTERN, "")
    .replace(DASH_PATTERN, " ")
    .replace(/\s-\s/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? sanitizeInsightString(v) : null
}

function asNullableString(v: unknown): string | null {
  if (v === null || v === undefined) return null
  return typeof v === "string" ? sanitizeInsightString(v) : null
}

function extractReminders(reply: string): ParsedReminderDirective[] {
  const reminders: ParsedReminderDirective[] = []
  for (const rawLine of reply.split(/\r?\n/)) {
    const line = rawLine.trim()
    const reminderMatch = REMINDER_PATTERN.exec(line)
    if (!reminderMatch) continue
    const at = (reminderMatch[1] ?? "").trim()
    const title = (reminderMatch[2] ?? "").trim()
    const body = (reminderMatch[3] ?? "").trim()
    if (at && title && body && Number.isFinite(Date.parse(at))) {
      reminders.push({
        at,
        title: sanitizeInsightString(title),
        body: sanitizeInsightString(body),
      })
    }
  }
  return reminders
}

// ---------------------------------------------------------------------------
// Morning
// ---------------------------------------------------------------------------

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
  const reminders = extractReminders(reply)

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
// Evening
// ---------------------------------------------------------------------------

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

type RecapItemKind = "session" | "submission" | "acted_summary"

interface ParsedRecapItem {
  readonly kind: RecapItemKind
  readonly course: string | null
  readonly label: string
}

function parseRecapItems(v: unknown): ReadonlyArray<ParsedRecapItem> {
  if (!Array.isArray(v)) return []
  const out: ParsedRecapItem[] = []
  for (const item of v as ReadonlyArray<RawRecapItem>) {
    if (!item || typeof item !== "object") continue
    const kind = typeof item.kind === "string" ? item.kind : ""
    if (!RECAP_KINDS.has(kind)) continue
    const label = asString(item.label)
    if (label === null) continue
    out.push({
      kind: kind as RecapItemKind,
      course: asNullableString(item.course),
      label,
    })
  }
  return out
}

function parseRecap(
  v: unknown,
): { summary: string; items: ReadonlyArray<ParsedRecapItem> } | null {
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
 * extracts sibling REMINDER lines. Defensive emoji + dash stripping inherited
 * from the shared sanitizer.
 */
export function parseEveningInsight(reply: string): ParsedEveningInsight {
  const reminders = extractReminders(reply)

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
