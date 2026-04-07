import { Schema } from "@effect/schema"
import { CourseWorkItemId, CourseId } from "./ids.js"

export const SourceType = Schema.Literal("assignment", "module", "page", "announcement")
export type SourceType = Schema.Schema.Type<typeof SourceType>

export const FreshnessStatus = Schema.Literal("fresh", "stale", "unknown")
export type FreshnessStatus = Schema.Schema.Type<typeof FreshnessStatus>

export const CourseWorkItem = Schema.Struct({
  id: CourseWorkItemId,
  courseId: CourseId,
  title: Schema.String,
  effectiveDueAt: Schema.optional(Schema.String),
  sourceType: SourceType,
  freshnessStatus: FreshnessStatus,
  pointsPossible: Schema.optional(Schema.Number),
  submissionStatus: Schema.optional(Schema.String),
  grade: Schema.optional(Schema.String),
})
export type CourseWorkItem = Schema.Schema.Type<typeof CourseWorkItem>
