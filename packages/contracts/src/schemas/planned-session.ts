import { Schema } from "@effect/schema"
import { TaskId, SessionId, CourseId } from "./ids.js"

export const SessionStatus = Schema.Literal("scheduled", "completed", "skipped", "partial", "unresolved", "cancelled")
export type SessionStatus = Schema.Schema.Type<typeof SessionStatus>

export const PlannedSession = Schema.Struct({
  id: SessionId,
  taskId: TaskId,
  courseId: CourseId,
  startTime: Schema.String,
  endTime: Schema.String,
  status: SessionStatus,
  completionNote: Schema.optional(Schema.String),
  sessionLabel: Schema.optional(Schema.String),
  courseName: Schema.optional(Schema.String),
  assignmentTitle: Schema.optional(Schema.String),
})
export type PlannedSession = Schema.Schema.Type<typeof PlannedSession>
