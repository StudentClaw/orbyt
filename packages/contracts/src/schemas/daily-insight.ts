import { Schema } from "@effect/schema"
import { MorningInsightPayload } from "./morning-insight.js"
import { EveningInsightPayload } from "./evening-insight.js"

/**
 * Discriminated union of every structured insight payload the daily-pulse cron
 * can produce. Activity feed entries persist this in the `structured` field;
 * the UI dispatches on `slot` to pick the renderer.
 */
export const DailyInsightPayload = Schema.Union(
  MorningInsightPayload,
  EveningInsightPayload,
)
export type DailyInsightPayload = Schema.Schema.Type<typeof DailyInsightPayload>
