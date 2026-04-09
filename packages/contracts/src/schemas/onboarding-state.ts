import { Schema } from "@effect/schema"

export const OnboardingStepStatus = Schema.Literal("pending", "completed", "skipped")
export type OnboardingStepStatus = Schema.Schema.Type<typeof OnboardingStepStatus>

export const OnboardingState = Schema.Struct({
  step: Schema.Number,
  status: OnboardingStepStatus,
  completedAt: Schema.optional(Schema.String),
})
export type OnboardingState = Schema.Schema.Type<typeof OnboardingState>
