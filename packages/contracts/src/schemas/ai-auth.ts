import { Schema } from "@effect/schema"

export const AiAuthStatus = Schema.Literal("pending", "connected", "skipped")
export type AiAuthStatus = Schema.Schema.Type<typeof AiAuthStatus>

export const AiAuthState = Schema.Struct({
  status: AiAuthStatus,
  provider: Schema.NullOr(Schema.String),
  connectedAt: Schema.NullOr(Schema.String),
})
export type AiAuthState = Schema.Schema.Type<typeof AiAuthState>

export const SetAiAuthStatusParams = Schema.Struct({
  status: AiAuthStatus,
  provider: Schema.optional(Schema.NullOr(Schema.String)),
})
export type SetAiAuthStatusParams = Schema.Schema.Type<typeof SetAiAuthStatusParams>
