import { Schema } from "@effect/schema"

export const RpcErrorPayload = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
})

export const RpcRequestEnvelope = Schema.Struct({
  kind: Schema.Literal("request"),
  id: Schema.String,
  method: Schema.String,
  params: Schema.Unknown,
})

export const RpcSuccessResponseEnvelope = Schema.Struct({
  kind: Schema.Literal("response"),
  id: Schema.String,
  ok: Schema.Literal(true),
  result: Schema.Unknown,
})

export const RpcErrorResponseEnvelope = Schema.Struct({
  kind: Schema.Literal("response"),
  id: Schema.String,
  ok: Schema.Literal(false),
  error: RpcErrorPayload,
})

export const RpcPushEnvelope = Schema.Struct({
  kind: Schema.Literal("push"),
  channel: Schema.String,
  sequence: Schema.Number,
  data: Schema.Unknown,
})

export const RpcResponseEnvelope = Schema.Union(
  RpcSuccessResponseEnvelope,
  RpcErrorResponseEnvelope,
)

export const RpcServerEnvelope = Schema.Union(
  RpcResponseEnvelope,
  RpcPushEnvelope,
)

export type RpcErrorPayload = Schema.Schema.Type<typeof RpcErrorPayload>
export type RpcRequestEnvelope = Schema.Schema.Type<typeof RpcRequestEnvelope>
export type RpcSuccessResponseEnvelope = Schema.Schema.Type<typeof RpcSuccessResponseEnvelope>
export type RpcErrorResponseEnvelope = Schema.Schema.Type<typeof RpcErrorResponseEnvelope>
export type RpcResponseEnvelope = Schema.Schema.Type<typeof RpcResponseEnvelope>
export type RpcPushEnvelope = Schema.Schema.Type<typeof RpcPushEnvelope>
export type RpcServerEnvelope = Schema.Schema.Type<typeof RpcServerEnvelope>
