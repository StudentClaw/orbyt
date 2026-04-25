import { Schema } from "@effect/schema"
import { CourseId } from "./ids.js"

const MAX_COURSE_NAME_LENGTH = 500
const MAX_COURSE_CODE_LENGTH = 100
const MAX_COURSE_PROFESSOR_LENGTH = 200
const MAX_COURSE_CANVAS_ID_LENGTH = 100
const MAX_COURSE_TERM_LENGTH = 200
const MAX_ISO_TIMESTAMP_LENGTH = 64
const MAX_COURSE_COLOR_LENGTH = 100

export const Course = Schema.Struct({
  id: CourseId,
  name: Schema.String.pipe(Schema.maxLength(MAX_COURSE_NAME_LENGTH)),
  code: Schema.String.pipe(Schema.maxLength(MAX_COURSE_CODE_LENGTH)),
  professor: Schema.optional(Schema.String.pipe(Schema.maxLength(MAX_COURSE_PROFESSOR_LENGTH))),
  canvasId: Schema.optional(Schema.String.pipe(Schema.maxLength(MAX_COURSE_CANVAS_ID_LENGTH))),
  term: Schema.optional(Schema.String.pipe(Schema.maxLength(MAX_COURSE_TERM_LENGTH))),
  lastSyncAt: Schema.optional(Schema.String.pipe(Schema.maxLength(MAX_ISO_TIMESTAMP_LENGTH))),
  color: Schema.optional(Schema.String.pipe(Schema.maxLength(MAX_COURSE_COLOR_LENGTH))),
})
export type Course = Schema.Schema.Type<typeof Course>
