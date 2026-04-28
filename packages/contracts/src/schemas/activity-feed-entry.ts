import { Schema } from "@effect/schema"
import { ActivityEntryId } from "./ids.js"

export const ActivityCategory = Schema.Literal(
  "canvas",
  "planner",
  "workflow",
  "insight",
  "cron",
  "reminder",
)
export type ActivityCategory = Schema.Schema.Type<typeof ActivityCategory>

export const ActivityFeedEntry = Schema.Struct({
  id: ActivityEntryId,
  category: ActivityCategory,
  type: Schema.String,
  title: Schema.String,
  body: Schema.optional(Schema.String),
  priority: Schema.optional(Schema.Number),
  deepLink: Schema.optional(Schema.String),
  notify: Schema.optional(Schema.Boolean),
  actedOn: Schema.optional(Schema.NullOr(Schema.Boolean)),
  actedAt: Schema.optional(Schema.NullOr(Schema.Number)),
  createdAt: Schema.optional(Schema.String),
})
export type ActivityFeedEntry = Schema.Schema.Type<typeof ActivityFeedEntry>
