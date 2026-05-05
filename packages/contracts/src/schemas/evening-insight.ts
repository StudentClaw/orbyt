import { Schema } from "@effect/schema"

/**
 * One concrete piece of the day's record. Sessions and submissions are course-
 * tagged; acted_summary aggregates dismissed/acted notifications into a single
 * count so the recap chip row stays scannable instead of noisy.
 */
export const EveningRecapItem = Schema.Struct({
  kind: Schema.Literal("session", "submission", "acted_summary"),
  course: Schema.NullOr(Schema.String),
  label: Schema.String,
})
export type EveningRecapItem = Schema.Schema.Type<typeof EveningRecapItem>

export const EveningRecap = Schema.Struct({
  summary: Schema.String,
  items: Schema.Array(EveningRecapItem),
})
export type EveningRecap = Schema.Schema.Type<typeof EveningRecap>

/**
 * Default evening shape: a four-component analytical wind-down briefing.
 *   recap        → factual record of today (summary string + structured chips)
 *   throughline  → cross-temporal pattern across the 7-day window; the insight
 *   tomorrow     → soft framing only, no action list
 *   windDown     → optional closure beat; null when not warranted
 */
export const EveningBriefing = Schema.Struct({
  slot: Schema.Literal("evening"),
  mode: Schema.Literal("briefing"),
  headline: Schema.String,
  recap: EveningRecap,
  throughline: Schema.String,
  tomorrow: Schema.String,
  windDown: Schema.NullOr(Schema.String),
})
export type EveningBriefing = Schema.Schema.Type<typeof EveningBriefing>

/**
 * Quiet-day shape: emitted when both today is empty (no sessions, submissions,
 * acted notifications) and nothing presses tomorrow (no assignment-type item
 * within 24h). The week-pattern throughline still earns its keep — quiet
 * evenings are the best moment for reflection.
 */
export const EveningQuietCard = Schema.Struct({
  slot: Schema.Literal("evening"),
  mode: Schema.Literal("quiet"),
  headline: Schema.String,
  throughline: Schema.String,
  reflection: Schema.NullOr(Schema.String),
})
export type EveningQuietCard = Schema.Schema.Type<typeof EveningQuietCard>

export const EveningInsightPayload = Schema.Union(
  EveningBriefing,
  EveningQuietCard,
)
export type EveningInsightPayload = Schema.Schema.Type<
  typeof EveningInsightPayload
>
