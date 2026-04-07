import { Schema } from "@effect/schema"
import { CourseId } from "./ids.js"

export const Grade = Schema.Struct({
  courseId: CourseId,
  assignmentId: Schema.String,
  score: Schema.Number,
  maxScore: Schema.Number,
  letterGrade: Schema.optional(Schema.String),
  postedAt: Schema.optional(Schema.String),
})
export type Grade = Schema.Schema.Type<typeof Grade>
