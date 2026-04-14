import { Schema } from "@effect/schema"
import { CanvasChangeDetected, CanvasSyncProgress } from "./canvas.js"

export { CanvasChangeDetected, CanvasSyncProgress } from "./canvas.js"

export const ChatStreaming = Schema.Struct({
  event: Schema.Literal("chat.streaming"),
  data: Schema.Struct({
    token: Schema.String,
    sequenceNum: Schema.Number,
  }),
})

export const ChatComplete = Schema.Struct({
  event: Schema.Literal("chat.complete"),
  data: Schema.Struct({
    messageId: Schema.String,
    content: Schema.String,
  }),
})

export const ChatToolCall = Schema.Struct({
  event: Schema.Literal("chat.toolCall"),
  data: Schema.Struct({
    toolName: Schema.String,
    args: Schema.String,
  }),
})

export const ActivityFeedUpsert = Schema.Struct({
  event: Schema.Literal("activity.feedUpsert"),
  data: Schema.Struct({
    entryId: Schema.String,
    title: Schema.String,
    category: Schema.String,
  }),
})

export const PlannerSessionCheckIn = Schema.Struct({
  event: Schema.Literal("planner.sessionCheckIn"),
  data: Schema.Struct({
    sessionId: Schema.String,
  }),
})

export const DashboardUpdate = Schema.Struct({
  event: Schema.Literal("dashboard.update"),
  data: Schema.Struct({
    section: Schema.String,
  }),
})

export const HealthPong = Schema.Struct({
  event: Schema.Literal("health.pong"),
  data: Schema.Struct({
    uptime: Schema.Number,
  }),
})

export const ErrorEvent = Schema.Struct({
  event: Schema.Literal("error"),
  data: Schema.Struct({
    code: Schema.Number,
    message: Schema.String,
    requestId: Schema.optional(Schema.String),
  }),
})

export const ServerEvent = Schema.Union(
  ChatStreaming,
  ChatComplete,
  ChatToolCall,
  CanvasSyncProgress,
  CanvasChangeDetected,
  ActivityFeedUpsert,
  PlannerSessionCheckIn,
  DashboardUpdate,
  HealthPong,
  ErrorEvent,
)
export type ServerEvent = Schema.Schema.Type<typeof ServerEvent>
