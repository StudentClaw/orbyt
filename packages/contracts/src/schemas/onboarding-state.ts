import { Schema } from "@effect/schema"

export const OnboardingStepName = Schema.Literal(
  "dna-discovery",
  "active-hours",
  "busy-grid",
  "ai-connect",
  "canvas-sync",
  "launch",
)
export type OnboardingStepName = Schema.Schema.Type<typeof OnboardingStepName>

export const OnboardingStepStatus = Schema.Literal("pending", "completed", "skipped")
export type OnboardingStepStatus = Schema.Schema.Type<typeof OnboardingStepStatus>

export const OnboardingOverallStatus = Schema.Literal("in_progress", "completed")
export type OnboardingOverallStatus = Schema.Schema.Type<typeof OnboardingOverallStatus>

export const OnboardingStepRecord = Schema.Struct({
  stepName: OnboardingStepName,
  status: OnboardingStepStatus,
  completedAt: Schema.NullOr(Schema.String),
})
export type OnboardingStepRecord = Schema.Schema.Type<typeof OnboardingStepRecord>

export const OnboardingSnapshot = Schema.Struct({
  steps: Schema.Array(OnboardingStepRecord),
  overallStatus: OnboardingOverallStatus,
})
export type OnboardingSnapshot = Schema.Schema.Type<typeof OnboardingSnapshot>

export const SetStepStatusParams = Schema.Struct({
  stepName: OnboardingStepName,
  status: OnboardingStepStatus,
})
export type SetStepStatusParams = Schema.Schema.Type<typeof SetStepStatusParams>

export const SetOverallStatusParams = Schema.Struct({
  status: OnboardingOverallStatus,
})
export type SetOverallStatusParams = Schema.Schema.Type<typeof SetOverallStatusParams>
