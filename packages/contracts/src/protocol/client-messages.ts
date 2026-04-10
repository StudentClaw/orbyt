import { Schema } from "@effect/schema"
import {
  CanvasGetAnnouncementsParams,
  CanvasGetCourseworkDetailParams,
  CanvasGetCourseworkParams,
  CanvasGetCoursesParams,
  CanvasGetGradesParams,
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

export const CanvasGetCourses = Schema.Struct({
  method: Schema.Literal("canvas.getCourses"),
  id: Schema.String,
  params: CanvasGetCoursesParams,
})

export const CanvasGetCoursework = Schema.Struct({
  method: Schema.Literal("canvas.getCoursework"),
  id: Schema.String,
  params: CanvasGetCourseworkParams,
})

export const CanvasGetCourseworkDetail = Schema.Struct({
  method: Schema.Literal("canvas.getCourseworkDetail"),
  id: Schema.String,
  params: CanvasGetCourseworkDetailParams,
})

export const CanvasGetGrades = Schema.Struct({
  method: Schema.Literal("canvas.getGrades"),
  id: Schema.String,
  params: CanvasGetGradesParams,
})

export const CanvasGetAnnouncements = Schema.Struct({
  method: Schema.Literal("canvas.getAnnouncements"),
  id: Schema.String,
  params: CanvasGetAnnouncementsParams,
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
  CanvasGetCourses,
  CanvasGetCoursework,
  CanvasGetCourseworkDetail,
  CanvasGetGrades,
  CanvasGetAnnouncements,
  DashboardRefresh,
  HealthPing,
)
export type ClientMessage = Schema.Schema.Type<typeof ClientMessage>
