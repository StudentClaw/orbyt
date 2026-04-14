import { Schema } from "@effect/schema"

export const CourseId = Schema.String.pipe(Schema.brand("CourseId"))
export type CourseId = Schema.Schema.Type<typeof CourseId>

export const CourseWorkItemId = Schema.String.pipe(Schema.brand("CourseWorkItemId"))
export type CourseWorkItemId = Schema.Schema.Type<typeof CourseWorkItemId>

export const SkillId = Schema.String.pipe(Schema.brand("SkillId"))
export type SkillId = Schema.Schema.Type<typeof SkillId>

export const TaskId = Schema.String.pipe(Schema.brand("TaskId"))
export type TaskId = Schema.Schema.Type<typeof TaskId>

export const SessionId = Schema.String.pipe(Schema.brand("SessionId"))
export type SessionId = Schema.Schema.Type<typeof SessionId>

export const ActivityEntryId = Schema.String.pipe(Schema.brand("ActivityEntryId"))
export type ActivityEntryId = Schema.Schema.Type<typeof ActivityEntryId>

export const AnnouncementId = Schema.String.pipe(Schema.brand("AnnouncementId"))
export type AnnouncementId = Schema.Schema.Type<typeof AnnouncementId>
