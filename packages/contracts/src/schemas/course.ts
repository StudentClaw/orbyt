import { Schema } from "@effect/schema"
import { CourseId } from "./ids.js"

export const Course = Schema.Struct({
  id: CourseId,
  name: Schema.String,
  code: Schema.String,
  professor: Schema.optional(Schema.String),
  canvasId: Schema.optional(Schema.String),
  term: Schema.optional(Schema.String),
  lastSyncAt: Schema.optional(Schema.String),
})
export type Course = Schema.Schema.Type<typeof Course>
