import { Schema } from "@effect/schema"

/**
 * Single must-do item: an assignment, quiz, or other coursework actually due
 * today. Rendered as a clickable row in the morning briefing card.
 */
export const MorningMustDoItem = Schema.Struct({
  course: Schema.String,
  title: Schema.String,
  dueTime: Schema.NullOr(Schema.String),
  deepLink: Schema.NullOr(Schema.String),
})
export type MorningMustDoItem = Schema.Schema.Type<typeof MorningMustDoItem>

/**
 * Default morning shape: a four-component daily briefing.
 *   anchor  → 1-line scene-set (date, class count, planned-block count)
 *   mustDo  → 0-N items actually due today, with deep links
 *   lever   → the strategic move-of-the-day; the actual *insight*
 *   horizon → 1-line heads-up about the biggest thing later this week
 */
export const MorningBriefing = Schema.Struct({
  slot: Schema.Literal("morning"),
  mode: Schema.Literal("briefing"),
  headline: Schema.String,
  anchor: Schema.String,
  mustDo: Schema.Array(MorningMustDoItem),
  lever: Schema.String,
  horizon: Schema.NullOr(Schema.String),
})
export type MorningBriefing = Schema.Schema.Type<typeof MorningBriefing>

/**
 * Quiet-day shape: emitted when the day has no anchor (no mustDo, no planned
 * blocks, no notable horizon item). Carries only the headline and the lever
 * (and optionally a one-line reflective follow-up).
 */
export const MorningQuietCard = Schema.Struct({
  slot: Schema.Literal("morning"),
  mode: Schema.Literal("quiet"),
  headline: Schema.String,
  lever: Schema.String,
  reflection: Schema.NullOr(Schema.String),
})
export type MorningQuietCard = Schema.Schema.Type<typeof MorningQuietCard>

export const MorningInsightPayload = Schema.Union(
  MorningBriefing,
  MorningQuietCard,
)
export type MorningInsightPayload = Schema.Schema.Type<
  typeof MorningInsightPayload
>
