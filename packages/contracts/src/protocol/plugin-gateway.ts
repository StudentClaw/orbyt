import { Schema } from "@effect/schema"

export const GatewayToolInventoryEntry = Schema.Struct({
  exposedToolName: Schema.String,
  description: Schema.String,
  pluginId: Schema.String,
  rawToolName: Schema.String,
})

export const GatewayToolInventorySnapshot = Schema.Struct({
  revision: Schema.Number,
  observedAt: Schema.String,
  tools: Schema.Array(GatewayToolInventoryEntry),
})

export const GatewayToolInventoryReadResult = Schema.Struct({
  snapshot: GatewayToolInventorySnapshot,
})

export const GatewayToolCallParams = Schema.Struct({
  exposedToolName: Schema.String,
  args: Schema.Unknown,
})

export const GatewayToolCallFailureReason = Schema.Literal(
  "plugin_not_found",
  "plugin_not_running",
  "tool_not_available",
  "call_failed",
)

export const GatewayToolCallSuccess = Schema.Struct({
  ok: Schema.Literal(true),
  exposedToolName: Schema.String,
  pluginId: Schema.String,
  rawToolName: Schema.String,
  result: Schema.Unknown,
})

export const GatewayToolCallFailure = Schema.Struct({
  ok: Schema.Literal(false),
  exposedToolName: Schema.String,
  reason: GatewayToolCallFailureReason,
  message: Schema.String,
  pluginId: Schema.optional(Schema.String),
  rawToolName: Schema.optional(Schema.String),
})

export const GatewayToolCallResult = Schema.Union(
  GatewayToolCallSuccess,
  GatewayToolCallFailure,
)

export const GatewayToolsChangedEvent = Schema.Struct({
  type: Schema.Literal("toolsChanged"),
  snapshot: GatewayToolInventorySnapshot,
})

export type GatewayToolInventoryEntry = Schema.Schema.Type<typeof GatewayToolInventoryEntry>
export type GatewayToolInventorySnapshot = Schema.Schema.Type<typeof GatewayToolInventorySnapshot>
export type GatewayToolInventoryReadResult = Schema.Schema.Type<typeof GatewayToolInventoryReadResult>
export type GatewayToolCallParams = Schema.Schema.Type<typeof GatewayToolCallParams>
export type GatewayToolCallFailureReason = Schema.Schema.Type<typeof GatewayToolCallFailureReason>
export type GatewayToolCallSuccess = Schema.Schema.Type<typeof GatewayToolCallSuccess>
export type GatewayToolCallFailure = Schema.Schema.Type<typeof GatewayToolCallFailure>
export type GatewayToolCallResult = Schema.Schema.Type<typeof GatewayToolCallResult>
export type GatewayToolsChangedEvent = Schema.Schema.Type<typeof GatewayToolsChangedEvent>
