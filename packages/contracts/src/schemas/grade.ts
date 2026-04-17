import { Schema } from "@effect/schema"
import { CourseId } from "./ids.js"

const MAX_ASSIGNMENT_ID_LENGTH = 200
const MAX_LETTER_GRADE_LENGTH = 32
const MAX_ISO_TIMESTAMP_LENGTH = 64

const SAFE_ASSIGNMENT_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,200}$/

export const Grade = Schema.Struct({
  courseId: CourseId,
  assignmentId: Schema.String.pipe(
    Schema.maxLength(MAX_ASSIGNMENT_ID_LENGTH),
    Schema.pattern(SAFE_ASSIGNMENT_ID_PATTERN),
  ),
  score: Schema.Number,
  maxScore: Schema.Number,
  letterGrade: Schema.optional(Schema.String.pipe(Schema.maxLength(MAX_LETTER_GRADE_LENGTH))),
  postedAt: Schema.optional(Schema.String.pipe(Schema.maxLength(MAX_ISO_TIMESTAMP_LENGTH))),
})
export type Grade = Schema.Schema.Type<typeof Grade>
