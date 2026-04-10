import { Schema } from "@effect/schema"
import { CourseId, CourseWorkItemId } from "../schemas/ids.js"
import {
  Announcement,
  CanvasChangeEvent,
  CanvasCourseworkDetail,
  CanvasSyncState,
  Course,
  CourseWorkItem,
  Grade,
} from "../schemas/index.js"

export const CanvasRefreshMode = Schema.Literal("never", "if_stale", "force")
export type CanvasRefreshMode = Schema.Schema.Type<typeof CanvasRefreshMode>

export const CanvasGetCoursesParams = Schema.Struct({})
export const CanvasGetCoursesResult = Schema.Struct({
  courses: Schema.Array(Course),
})

export const CanvasGetCourseworkParams = Schema.Struct({
  courseId: Schema.optional(CourseId),
  sources: Schema.optional(Schema.Array(Schema.Literal("assignment", "module", "page", "announcement"))),
  dueAfter: Schema.optional(Schema.String),
  dueBefore: Schema.optional(Schema.String),
  includeCompleted: Schema.optional(Schema.Boolean),
  refresh: Schema.optional(CanvasRefreshMode),
})
export const CanvasGetCourseworkResult = Schema.Struct({
  items: Schema.Array(CourseWorkItem),
})

export const CanvasGetCourseworkDetailByItem = Schema.Struct({
  courseWorkItemId: CourseWorkItemId,
})

export const CanvasGetCourseworkDetailBySource = Schema.Struct({
  sourceType: Schema.Literal("assignment", "module", "page", "announcement"),
  sourceId: Schema.String,
})

export const CanvasGetCourseworkDetailParams = Schema.Union(
  CanvasGetCourseworkDetailByItem,
  CanvasGetCourseworkDetailBySource,
)
export const CanvasGetCourseworkDetailResult = Schema.Struct({
  detail: CanvasCourseworkDetail,
})

export const CanvasGetGradesParams = Schema.Struct({
  courseId: CourseId,
  refresh: Schema.optional(CanvasRefreshMode),
})
export const CanvasGetGradesResult = Schema.Struct({
  grades: Schema.Array(Grade),
})

export const CanvasGetAnnouncementsParams = Schema.Struct({
  courseId: Schema.optional(CourseId),
  limit: Schema.optional(Schema.Number),
  refresh: Schema.optional(CanvasRefreshMode),
})
export const CanvasGetAnnouncementsResult = Schema.Struct({
  announcements: Schema.Array(Announcement),
})

export const CanvasSyncParams = Schema.Struct({
  courseId: Schema.optional(CourseId),
})
export const CanvasSyncResult = Schema.Struct({
  state: CanvasSyncState,
})

export const CanvasSyncProgress = Schema.Struct({
  event: Schema.Literal("canvas.syncProgress"),
  data: Schema.Struct({
    courseId: Schema.optional(CourseId),
    progress: Schema.Number,
    status: Schema.Literal("queued", "syncing", "done", "error", "offline", "rate_limited"),
    message: Schema.optional(Schema.String),
  }),
})

export const CanvasChangeDetected = Schema.Struct({
  event: Schema.Literal("canvas.changeDetected"),
  data: CanvasChangeEvent,
})

export type CanvasGetCoursesParams = Schema.Schema.Type<typeof CanvasGetCoursesParams>
export type CanvasGetCoursesResult = Schema.Schema.Type<typeof CanvasGetCoursesResult>
export type CanvasGetCourseworkParams = Schema.Schema.Type<typeof CanvasGetCourseworkParams>
export type CanvasGetCourseworkResult = Schema.Schema.Type<typeof CanvasGetCourseworkResult>
export type CanvasGetCourseworkDetailByItem = Schema.Schema.Type<typeof CanvasGetCourseworkDetailByItem>
export type CanvasGetCourseworkDetailBySource = Schema.Schema.Type<typeof CanvasGetCourseworkDetailBySource>
export type CanvasGetCourseworkDetailParams = Schema.Schema.Type<typeof CanvasGetCourseworkDetailParams>
export type CanvasGetCourseworkDetailResult = Schema.Schema.Type<typeof CanvasGetCourseworkDetailResult>
export type CanvasGetGradesParams = Schema.Schema.Type<typeof CanvasGetGradesParams>
export type CanvasGetGradesResult = Schema.Schema.Type<typeof CanvasGetGradesResult>
export type CanvasGetAnnouncementsParams = Schema.Schema.Type<typeof CanvasGetAnnouncementsParams>
export type CanvasGetAnnouncementsResult = Schema.Schema.Type<typeof CanvasGetAnnouncementsResult>
export type CanvasSyncParams = Schema.Schema.Type<typeof CanvasSyncParams>
export type CanvasSyncResult = Schema.Schema.Type<typeof CanvasSyncResult>
export type CanvasSyncProgress = Schema.Schema.Type<typeof CanvasSyncProgress>
export type CanvasChangeDetected = Schema.Schema.Type<typeof CanvasChangeDetected>
