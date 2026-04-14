import { Schema } from "@effect/schema"
import { CourseWorkItemId, CourseId } from "./ids.js"

export const SourceType = Schema.Literal("assignment", "module", "page", "announcement")
export type SourceType = Schema.Schema.Type<typeof SourceType>

export const SourceDueDateKind = Schema.Literal(
  "assignment_due_at",
  "assignment_override_due_at",
  "module_deadline",
  "page_deadline",
  "announcement_deadline",
  "inferred",
)
export type SourceDueDateKind = Schema.Schema.Type<typeof SourceDueDateKind>

export const FreshnessStatus = Schema.Literal("fresh", "stale", "unknown")
export type FreshnessStatus = Schema.Schema.Type<typeof FreshnessStatus>

export const CourseWorkItem = Schema.Struct({
  id: CourseWorkItemId,
  courseId: CourseId,
  title: Schema.String,
  description: Schema.optional(Schema.String),
  effectiveDueAt: Schema.optional(Schema.String),
  sourceType: SourceType,
  sourceId: Schema.String,
  sourceDueDateKind: Schema.optional(SourceDueDateKind),
  freshnessStatus: FreshnessStatus,
  cachedAt: Schema.optional(Schema.String),
  lastVerifiedAt: Schema.optional(Schema.String),
  sourceUpdatedAt: Schema.optional(Schema.String),
  htmlUrl: Schema.optional(Schema.String),
  pointsPossible: Schema.optional(Schema.Number),
  submissionStatus: Schema.optional(Schema.String),
  grade: Schema.optional(Schema.String),
})
export type CourseWorkItem = Schema.Schema.Type<typeof CourseWorkItem>
