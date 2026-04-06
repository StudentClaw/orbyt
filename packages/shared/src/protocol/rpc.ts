import { Schema } from "@effect/schema"

export const JsonRpcRequest = Schema.Struct({
  jsonrpc: Schema.Literal("2.0"),
  method: Schema.String,
  id: Schema.Union(Schema.String, Schema.Number),
  params: Schema.optional(Schema.Unknown),
})

export const JsonRpcError = Schema.Struct({
  code: Schema.Number,
  message: Schema.String,
  data: Schema.optional(Schema.Unknown),
})

export const JsonRpcResponse = Schema.Struct({
  jsonrpc: Schema.Literal("2.0"),
  id: Schema.Union(Schema.String, Schema.Number),
  result: Schema.optional(Schema.Unknown),
  error: Schema.optional(JsonRpcError),
})

export type JsonRpcRequest = Schema.Schema.Type<typeof JsonRpcRequest>
export type JsonRpcResponse = Schema.Schema.Type<typeof JsonRpcResponse>
export type JsonRpcError = Schema.Schema.Type<typeof JsonRpcError>
