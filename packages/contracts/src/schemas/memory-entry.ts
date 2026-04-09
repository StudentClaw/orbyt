import { Schema } from "@effect/schema"

export const MemoryEntry = Schema.Struct({
  id: Schema.String,
  content: Schema.String,
  scope: Schema.String,
  source: Schema.String,
  createdAt: Schema.String,
  confidence: Schema.optional(Schema.Number),
})
export type MemoryEntry = Schema.Schema.Type<typeof MemoryEntry>
