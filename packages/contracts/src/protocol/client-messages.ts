import { Schema } from "@effect/schema"
import {
  CanvasAssignmentDetailsParams,
  CanvasArchiveAssignmentParams,
  CanvasUnarchiveAssignmentParams,
  CanvasCourseContentOverviewParams,
  CanvasCourseStructureParams,
  CanvasDownloadCourseFileParams,
  CanvasGetMyCourseGradesParams,
  CanvasGetMyPeerReviewsTodoParams,
  CanvasGetMySubmissionStatusParams,
  CanvasGetMyTodoItemsParams,
  CanvasGetMyUpcomingAssignmentsParams,
  CanvasListAssignmentsParams,
  CanvasListCoursesParams,
  CanvasSyncParams,
} from "./canvas.js"

export const ChatSendMessage = Schema.Struct({
  method: Schema.Literal("chat.sendMessage"),
  id: Schema.String,
  params: Schema.Struct({
    content: Schema.String,
    sessionId: Schema.optional(Schema.String),
  }),
})

export const ChatInterrupt = Schema.Struct({
  method: Schema.Literal("chat.interrupt"),
  id: Schema.String,
  params: Schema.Struct({}),
})

export const CanvasSync = Schema.Struct({
  method: Schema.Literal("canvas.sync"),
  id: Schema.String,
  params: CanvasSyncParams,
})

export const CanvasListCourses = Schema.Struct({
  method: Schema.Literal("canvas.listCourses"),
  id: Schema.String,
  params: CanvasListCoursesParams,
})

export const CanvasGetMyUpcomingAssignments = Schema.Struct({
  method: Schema.Literal("canvas.getMyUpcomingAssignments"),
  id: Schema.String,
  params: CanvasGetMyUpcomingAssignmentsParams,
})

export const CanvasGetMySubmissionStatus = Schema.Struct({
  method: Schema.Literal("canvas.getMySubmissionStatus"),
  id: Schema.String,
  params: CanvasGetMySubmissionStatusParams,
})

export const CanvasGetMyCourseGrades = Schema.Struct({
  method: Schema.Literal("canvas.getMyCourseGrades"),
  id: Schema.String,
  params: CanvasGetMyCourseGradesParams,
})

export const CanvasGetMyTodoItems = Schema.Struct({
  method: Schema.Literal("canvas.getMyTodoItems"),
  id: Schema.String,
  params: CanvasGetMyTodoItemsParams,
})

export const CanvasGetMyPeerReviewsTodo = Schema.Struct({
  method: Schema.Literal("canvas.getMyPeerReviewsTodo"),
  id: Schema.String,
  params: CanvasGetMyPeerReviewsTodoParams,
})

export const CanvasGetAssignmentDetails = Schema.Struct({
  method: Schema.Literal("canvas.getAssignmentDetails"),
  id: Schema.String,
  params: CanvasAssignmentDetailsParams,
})

export const CanvasListAssignments = Schema.Struct({
  method: Schema.Literal("canvas.listAssignments"),
  id: Schema.String,
  params: CanvasListAssignmentsParams,
})

export const CanvasArchiveAssignment = Schema.Struct({
  method: Schema.Literal("canvas.archiveAssignment"),
  id: Schema.String,
  params: CanvasArchiveAssignmentParams,
})

export const CanvasUnarchiveAssignment = Schema.Struct({
  method: Schema.Literal("canvas.unarchiveAssignment"),
  id: Schema.String,
  params: CanvasUnarchiveAssignmentParams,
})

export const CanvasGetCourseContentOverview = Schema.Struct({
  method: Schema.Literal("canvas.getCourseContentOverview"),
  id: Schema.String,
  params: CanvasCourseContentOverviewParams,
})

export const CanvasGetCourseStructure = Schema.Struct({
  method: Schema.Literal("canvas.getCourseStructure"),
  id: Schema.String,
  params: CanvasCourseStructureParams,
})

export const CanvasDownloadCourseFile = Schema.Struct({
  method: Schema.Literal("canvas.downloadCourseFile"),
  id: Schema.String,
  params: CanvasDownloadCourseFileParams,
})

export const DashboardRefresh = Schema.Struct({
  method: Schema.Literal("dashboard.refresh"),
  id: Schema.String,
  params: Schema.Struct({}),
})

export const HealthPing = Schema.Struct({
  method: Schema.Literal("health.ping"),
  id: Schema.String,
  params: Schema.Struct({}),
})

export const ClientMessage = Schema.Union(
  ChatSendMessage,
  ChatInterrupt,
  CanvasSync,
  CanvasListCourses,
  CanvasGetMyUpcomingAssignments,
  CanvasGetMySubmissionStatus,
  CanvasGetMyCourseGrades,
  CanvasGetMyTodoItems,
  CanvasGetMyPeerReviewsTodo,
  CanvasGetAssignmentDetails,
  CanvasListAssignments,
  CanvasArchiveAssignment,
  CanvasUnarchiveAssignment,
  CanvasGetCourseContentOverview,
  CanvasGetCourseStructure,
  CanvasDownloadCourseFile,
  DashboardRefresh,
  HealthPing,
)
export type ClientMessage = Schema.Schema.Type<typeof ClientMessage>
