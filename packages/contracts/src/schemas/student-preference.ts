import { Schema } from "@effect/schema"

export const StudentPreference = Schema.Struct({
  studyTimes: Schema.optional(Schema.Array(Schema.String)),
  courseRanking: Schema.optional(Schema.Array(Schema.String)),
  notificationPrefs: Schema.optional(Schema.Struct({
    enabled: Schema.Boolean,
    quietHoursStart: Schema.optional(Schema.String),
    quietHoursEnd: Schema.optional(Schema.String),
  })),
})
export type StudentPreference = Schema.Schema.Type<typeof StudentPreference>
