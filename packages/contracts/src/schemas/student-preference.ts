import { Schema } from "@effect/schema"

export const CalendarIntegration = Schema.Literal("none", "google", "apple")
export type CalendarIntegration = Schema.Schema.Type<typeof CalendarIntegration>

export const StudentPreference = Schema.Struct({
  studyTimes: Schema.Array(Schema.String),
  courseRanking: Schema.Array(Schema.String),
  maxSessionMins: Schema.Number,
  offLimitDays: Schema.Array(Schema.Number),
  notificationEnabled: Schema.Boolean,
  quietHoursStart: Schema.String,
  quietHoursEnd: Schema.String,
  calendarIntegration: CalendarIntegration,
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
})
export type UpdatePreferencesParams = Schema.Schema.Type<typeof UpdatePreferencesParams>
