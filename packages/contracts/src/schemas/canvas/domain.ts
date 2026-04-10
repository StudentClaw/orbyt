import { Schema } from "@effect/schema"
import { AnnouncementId, CourseId, CourseWorkItemId } from "../ids.js"
import { Grade } from "../grade.js"
import { CourseWorkItem, SourceType } from "../coursework-item.js"
import { CanvasRawCourseworkSource, CanvasSubmission } from "./raw.js"

export const AnnouncementAttachment = Schema.Struct({
  id: Schema.String,
  filename: Schema.String,
  displayName: Schema.String,
  contentType: Schema.optional(Schema.String),
  url: Schema.optional(Schema.String),
  size: Schema.optional(Schema.Number),
})
export type AnnouncementAttachment = Schema.Schema.Type<typeof AnnouncementAttachment>

export const Announcement = Schema.Struct({
  id: AnnouncementId,
  courseId: CourseId,
  title: Schema.String,
  body: Schema.optional(Schema.String),
  postedAt: Schema.optional(Schema.String),
  updatedAt: Schema.optional(Schema.String),
  contextCode: Schema.optional(Schema.String),
  htmlUrl: Schema.optional(Schema.String),
  attachments: Schema.Array(AnnouncementAttachment),
})
export type Announcement = Schema.Schema.Type<typeof Announcement>

export const CanvasSyncStatus = Schema.Literal(
  "idle",
  "queued",
  "syncing",
  "stale",
  "offline",
  "rate_limited",
  "error",
)
export type CanvasSyncStatus = Schema.Schema.Type<typeof CanvasSyncStatus>

export const CanvasSyncState = Schema.Struct({
  status: CanvasSyncStatus,
  progress: Schema.optional(Schema.Number),
  lastSyncAt: Schema.optional(Schema.String),
  nextSyncAt: Schema.optional(Schema.String),
  staleAt: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
  lastError: Schema.optional(Schema.String),
})
export type CanvasSyncState = Schema.Schema.Type<typeof CanvasSyncState>

export const CanvasAssignmentAdded = Schema.Struct({
  type: Schema.Literal("assignment.added"),
  courseId: CourseId,
  courseWorkItemId: CourseWorkItemId,
  item: CourseWorkItem,
  detectedAt: Schema.String,
})
export type CanvasAssignmentAdded = Schema.Schema.Type<typeof CanvasAssignmentAdded>

export const CanvasDeadlineChanged = Schema.Struct({
  type: Schema.Literal("deadline.changed"),
  courseId: CourseId,
  courseWorkItemId: CourseWorkItemId,
  previousDueAt: Schema.optional(Schema.String),
  effectiveDueAt: Schema.optional(Schema.String),
  sourceType: SourceType,
  detectedAt: Schema.String,
})
export type CanvasDeadlineChanged = Schema.Schema.Type<typeof CanvasDeadlineChanged>

export const CanvasGradePosted = Schema.Struct({
  type: Schema.Literal("grade.posted"),
  courseId: CourseId,
  assignmentId: Schema.String,
  grade: Grade,
  detectedAt: Schema.String,
})
export type CanvasGradePosted = Schema.Schema.Type<typeof CanvasGradePosted>

export const CanvasAnnouncementPosted = Schema.Struct({
  type: Schema.Literal("announcement.posted"),
  courseId: CourseId,
  announcement: Announcement,
  detectedAt: Schema.String,
})
export type CanvasAnnouncementPosted = Schema.Schema.Type<typeof CanvasAnnouncementPosted>

export const CanvasChangeEvent = Schema.Union(
  CanvasAssignmentAdded,
  CanvasDeadlineChanged,
  CanvasGradePosted,
  CanvasAnnouncementPosted,
)
export type CanvasChangeEvent = Schema.Schema.Type<typeof CanvasChangeEvent>

export const CanvasCourseworkDetail = Schema.Struct({
  item: CourseWorkItem,
  source: CanvasRawCourseworkSource,
  submission: Schema.optional(CanvasSubmission),
  grade: Schema.optional(Grade),
})
export type CanvasCourseworkDetail = Schema.Schema.Type<typeof CanvasCourseworkDetail>
