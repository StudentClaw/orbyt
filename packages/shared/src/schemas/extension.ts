import { Schema } from "@effect/schema"

export const ExtensionStatus = Schema.Literal("active", "inactive", "error")
export type ExtensionStatus = Schema.Schema.Type<typeof ExtensionStatus>

export const Extension = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  version: Schema.String,
  status: ExtensionStatus,
  permissions: Schema.Array(Schema.String),
})
export type Extension = Schema.Schema.Type<typeof Extension>
