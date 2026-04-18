import { Schema } from "@effect/schema"
import { CourseWorkItemId, CourseId } from "./ids.js"

const MAX_TITLE_LENGTH = 1_000
const MAX_DESCRIPTION_LENGTH = 10_000
const MAX_SOURCE_ID_LENGTH = 200
const MAX_ISO_TIMESTAMP_LENGTH = 64
const MAX_HTML_URL_LENGTH = 2_048
const MAX_SUBMISSION_STATUS_LENGTH = 64
const MAX_GRADE_LENGTH = 64

const SAFE_HTTPS_URL_PATTERN = /^https:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/

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

/**
 * Canvas content item link. Restricted to https:// URLs — other schemes
 * (e.g. `javascript:`) would be unsafe to render as href targets.
 */
export const CourseworkHtmlUrl = Schema.String.pipe(
  Schema.maxLength(MAX_HTML_URL_LENGTH),
  Schema.pattern(SAFE_HTTPS_URL_PATTERN),
)

export const CourseWorkItem = Schema.Struct({
  id: CourseWorkItemId,
  courseId: CourseId,
  title: Schema.String.pipe(Schema.maxLength(MAX_TITLE_LENGTH)),
  description: Schema.optional(Schema.String.pipe(Schema.maxLength(MAX_DESCRIPTION_LENGTH))),
  effectiveDueAt: Schema.optional(Schema.String.pipe(Schema.maxLength(MAX_ISO_TIMESTAMP_LENGTH))),
  sourceType: SourceType,
  sourceId: Schema.String.pipe(Schema.maxLength(MAX_SOURCE_ID_LENGTH)),
  sourceDueDateKind: Schema.optional(SourceDueDateKind),
  freshnessStatus: FreshnessStatus,
  cachedAt: Schema.optional(Schema.String.pipe(Schema.maxLength(MAX_ISO_TIMESTAMP_LENGTH))),
  lastVerifiedAt: Schema.optional(Schema.String.pipe(Schema.maxLength(MAX_ISO_TIMESTAMP_LENGTH))),
  sourceUpdatedAt: Schema.optional(Schema.String.pipe(Schema.maxLength(MAX_ISO_TIMESTAMP_LENGTH))),
  htmlUrl: Schema.optional(CourseworkHtmlUrl),
  pointsPossible: Schema.optional(Schema.Number),
  submissionStatus: Schema.optional(
    Schema.String.pipe(Schema.maxLength(MAX_SUBMISSION_STATUS_LENGTH)),
  ),
  grade: Schema.optional(Schema.String.pipe(Schema.maxLength(MAX_GRADE_LENGTH))),
})
export type CourseWorkItem = Schema.Schema.Type<typeof CourseWorkItem>
