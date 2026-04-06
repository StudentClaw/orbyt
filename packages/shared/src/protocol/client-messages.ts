import { Schema } from "@effect/schema"

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
  params: Schema.Struct({
    courseId: Schema.optional(Schema.String),
  }),
})

export const CanvasGetCourses = Schema.Struct({
  method: Schema.Literal("canvas.getCourses"),
  id: Schema.String,
  params: Schema.Struct({}),
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
  DashboardRefresh,
  HealthPing,
)
export type ClientMessage = Schema.Schema.Type<typeof ClientMessage>
