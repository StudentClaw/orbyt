import { Schema } from "@effect/schema"
import { SkillId } from "./ids.js"

export const SkillTier = Schema.Literal("curated", "custom")
export type SkillTier = Schema.Schema.Type<typeof SkillTier>

export const SkillSummary = Schema.Struct({
  id: SkillId,
  name: Schema.String,
  description: Schema.String,
  tier: SkillTier,
  version: Schema.String,
  requestedCapabilities: Schema.Array(Schema.String),
  grantedCapabilities: Schema.Array(Schema.String),
  missingCapabilities: Schema.Array(Schema.String),
  forkedFrom: Schema.NullOr(Schema.String),
  editable: Schema.Boolean,
})
export type SkillSummary = Schema.Schema.Type<typeof SkillSummary>

export const SkillsListResult = Schema.Struct({
  skills: Schema.Array(SkillSummary),
})
export type SkillsListResult = Schema.Schema.Type<typeof SkillsListResult>

export const ForkSkillParams = Schema.Struct({
  sourceSlug: SkillId,
  targetSlug: SkillId,
  displayName: Schema.optional(Schema.String),
  force: Schema.optional(Schema.Boolean),
})
export type ForkSkillParams = Schema.Schema.Type<typeof ForkSkillParams>

export const ForkSkillResult = Schema.Struct({
  skill: SkillSummary,
})
export type ForkSkillResult = Schema.Schema.Type<typeof ForkSkillResult>

export const GrantCapabilityParams = Schema.Struct({
  skillId: SkillId,
  capabilityKey: Schema.String,
})
export type GrantCapabilityParams = Schema.Schema.Type<typeof GrantCapabilityParams>

export const GrantCapabilityResult = Schema.Struct({
  skillId: SkillId,
  grantedCapabilities: Schema.Array(Schema.String),
})
export type GrantCapabilityResult = Schema.Schema.Type<typeof GrantCapabilityResult>

export const SaveCustomSkillParams = Schema.Struct({
  skillId: SkillId,
  markdown: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(200_000)),
})
export type SaveCustomSkillParams = Schema.Schema.Type<typeof SaveCustomSkillParams>

export const SaveCustomSkillResult = Schema.Struct({
  skill: SkillSummary,
})
export type SaveCustomSkillResult = Schema.Schema.Type<typeof SaveCustomSkillResult>
