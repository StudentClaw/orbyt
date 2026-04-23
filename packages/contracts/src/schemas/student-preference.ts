import { Schema } from "@effect/schema"

export const CalendarIntegration = Schema.Literal("none", "google", "apple")
export type CalendarIntegration = Schema.Schema.Type<typeof CalendarIntegration>

export const DefaultAccessMode = Schema.Literal("default", "full")
export type DefaultAccessMode = Schema.Schema.Type<typeof DefaultAccessMode>

export const StudentPreference = Schema.Struct({
  studyTimes: Schema.Array(Schema.String),
  courseRanking: Schema.Array(Schema.String),
  maxSessionMins: Schema.Number,
  offLimitDays: Schema.Array(Schema.Number),
  notificationEnabled: Schema.Boolean,
  quietHoursStart: Schema.String,
  quietHoursEnd: Schema.String,
  calendarIntegration: CalendarIntegration,
  memoryGraphPath: Schema.String,
  memoryGraphPathMode: Schema.Literal("default", "custom"),
  defaultAccessMode: DefaultAccessMode,
})
export type StudentPreference = Schema.Schema.Type<typeof StudentPreference>

export const UpdatePreferencesParams = Schema.Struct({
  studyTimes: Schema.optional(Schema.Array(Schema.String)),
  courseRanking: Schema.optional(Schema.Array(Schema.String)),
  maxSessionMins: Schema.optional(Schema.Number),
  offLimitDays: Schema.optional(Schema.Array(Schema.Number)),
  notificationEnabled: Schema.optional(Schema.Boolean),
  quietHoursStart: Schema.optional(Schema.String),
  quietHoursEnd: Schema.optional(Schema.String),
  calendarIntegration: Schema.optional(CalendarIntegration),
  memoryGraphPath: Schema.optional(Schema.NullOr(Schema.String)),
  defaultAccessMode: Schema.optional(DefaultAccessMode),
})
export type UpdatePreferencesParams = Schema.Schema.Type<typeof UpdatePreferencesParams>
