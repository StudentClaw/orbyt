import { Schema } from "@effect/schema"
import { OnboardingAnswers } from "./onboarding-answers.js"

export const ArchetypeStats = Schema.Struct({
  focus: Schema.Number,
  consistency: Schema.Number,
  stamina: Schema.Number,
  recovery: Schema.Number,
})
export type ArchetypeStats = Schema.Schema.Type<typeof ArchetypeStats>

export const StudentDna = Schema.Struct({
  archetypeId: Schema.String,
  trait: Schema.String,
  tagline: Schema.String,
  icon: Schema.String,
  hue: Schema.Number,
  accentHue: Schema.Number,
  isRare: Schema.Boolean,
  rarity: Schema.String,
  stats: ArchetypeStats,
  peak: Schema.String,
  style: Schema.String,
  motivation: Schema.String,
  name: Schema.String,
  aiPromptHint: Schema.String,
  recommendedFeatures: Schema.Array(Schema.String),
  sentimentAnchors: Schema.Array(Schema.String),
  orbytAdapts: Schema.String,
})
export type StudentDna = Schema.Schema.Type<typeof StudentDna>

export const ClassifyDnaParams = Schema.Struct({
  answers: OnboardingAnswers,
})
export type ClassifyDnaParams = Schema.Schema.Type<typeof ClassifyDnaParams>

export const CardWeight = Schema.Struct({
  cardId: Schema.String,
  weight: Schema.Number,
})
export type CardWeight = Schema.Schema.Type<typeof CardWeight>

export const ClassifyDnaResult = Schema.Struct({
  dna: StudentDna,
  cardWeights: Schema.Array(CardWeight),
  source: Schema.Literal("codex", "fallback"),
})
export type ClassifyDnaResult = Schema.Schema.Type<typeof ClassifyDnaResult>

export const SetAnswersParams = Schema.Struct({
  answers: OnboardingAnswers,
})
export type SetAnswersParams = Schema.Schema.Type<typeof SetAnswersParams>

export const GetDnaResult = Schema.Struct({
  answers: Schema.NullOr(OnboardingAnswers),
  dna: Schema.NullOr(StudentDna),
  cardWeights: Schema.Array(CardWeight),
})
export type GetDnaResult = Schema.Schema.Type<typeof GetDnaResult>
