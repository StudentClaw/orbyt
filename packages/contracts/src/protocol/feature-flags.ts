import { Schema } from "@effect/schema"

export const FeatureFlags = Schema.Struct({
  pluginSystem: Schema.Boolean,
})
export type FeatureFlags = Schema.Schema.Type<typeof FeatureFlags>
