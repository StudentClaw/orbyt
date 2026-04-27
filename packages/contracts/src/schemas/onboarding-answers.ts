import { Schema } from "@effect/schema"

export const StudentField = Schema.Literal(
  "stem",
  "humanities",
  "business",
  "arts",
  "health",
  "mix",
)
export type StudentField = Schema.Schema.Type<typeof StudentField>

export const StruggleTag = Schema.Literal(
  "procrastination",
  "focus",
  "overwhelm",
  "motivation",
  "memory",
  "stress",
)
export type StruggleTag = Schema.Schema.Type<typeof StruggleTag>

export const MotivationTag = Schema.Literal(
  "grades",
  "mastery",
  "career",
  "people",
  "streak",
  "curious",
)
export type MotivationTag = Schema.Schema.Type<typeof MotivationTag>

export const PeakTag = Schema.Literal(
  "dawn",
  "morning",
  "afternoon",
  "evening",
  "night",
  "chaos",
)
export type PeakTag = Schema.Schema.Type<typeof PeakTag>

export const StyleTag = Schema.Literal(
  "alone",
  "music",
  "group",
  "cafe",
  "visual",
  "doing",
)
export type StyleTag = Schema.Schema.Type<typeof StyleTag>

export const OnboardingAnswers = Schema.Struct({
  name: Schema.String,
  field: StudentField,
  struggle: StruggleTag,
  motivation: MotivationTag,
  peak: PeakTag,
  style: StyleTag,
  secretLove: Schema.String,
  wishBetter: Schema.String,
  pastHabit: Schema.String,
  forWho: Schema.String,
  successLook: Schema.String,
})
export type OnboardingAnswers = Schema.Schema.Type<typeof OnboardingAnswers>

export const PartialOnboardingAnswers = Schema.Struct({
  name: Schema.optional(Schema.String),
  field: Schema.optional(StudentField),
  struggle: Schema.optional(StruggleTag),
  motivation: Schema.optional(MotivationTag),
  peak: Schema.optional(PeakTag),
  style: Schema.optional(StyleTag),
  secretLove: Schema.optional(Schema.String),
  wishBetter: Schema.optional(Schema.String),
  pastHabit: Schema.optional(Schema.String),
  forWho: Schema.optional(Schema.String),
  successLook: Schema.optional(Schema.String),
})
export type PartialOnboardingAnswers = Schema.Schema.Type<typeof PartialOnboardingAnswers>
