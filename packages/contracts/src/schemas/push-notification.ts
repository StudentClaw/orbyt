import { Schema } from "@effect/schema"

export const PhonePushSettings = Schema.Struct({
  enabled: Schema.Boolean,
  workflowEventsEnabled: Schema.Boolean,
  weeklyInsightsEnabled: Schema.Boolean,
  quietHoursStart: Schema.String,
  quietHoursEnd: Schema.String,
  weeklyInsightsDay: Schema.Number,
  weeklyInsightsTime: Schema.String,
})
export type PhonePushSettings = Schema.Schema.Type<typeof PhonePushSettings>

export const UpdatePhonePushSettingsParams = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean),
  workflowEventsEnabled: Schema.optional(Schema.Boolean),
  weeklyInsightsEnabled: Schema.optional(Schema.Boolean),
  quietHoursStart: Schema.optional(Schema.String),
  quietHoursEnd: Schema.optional(Schema.String),
  weeklyInsightsDay: Schema.optional(Schema.Number),
  weeklyInsightsTime: Schema.optional(Schema.String),
})
export type UpdatePhonePushSettingsParams = Schema.Schema.Type<typeof UpdatePhonePushSettingsParams>
