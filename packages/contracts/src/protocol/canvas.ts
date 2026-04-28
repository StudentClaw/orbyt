import { Schema } from "@effect/schema"
import { CourseId, CourseWorkItemId } from "../schemas/ids.js"
import {
  Announcement,
  CanvasAssignmentWithSubmission,
  CanvasChangeEvent,
  CanvasConversation,
  CanvasCourse,
  CanvasCourseworkDetail,
  CanvasDiscussionEntry,
  CanvasDiscussionTopic,
  CanvasFile,
  CanvasModule,
  CanvasModuleItem,
  CanvasPage,
  CanvasSyncState,
  Course,
  CourseWorkItem,
  Grade,
} from "../schemas/index.js"

export const CanvasRefreshMode = Schema.Literal("never", "if_stale", "force")
export type CanvasRefreshMode = Schema.Schema.Type<typeof CanvasRefreshMode>

export const CanvasStudentToolCategory = Schema.Literal("self", "shared_read", "student_action")
export type CanvasStudentToolCategory = Schema.Schema.Type<typeof CanvasStudentToolCategory>

export const CanvasStudentToolReference = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  category: CanvasStudentToolCategory,
})
export type CanvasStudentToolReference = Schema.Schema.Type<typeof CanvasStudentToolReference>

export const CanvasGetCoursesParams = Schema.Struct({})
export const CanvasGetCoursesResult = Schema.Struct({
  courses: Schema.Array(Course),
})
export const CanvasListCoursesParams = Schema.Struct({})
export const CanvasListCoursesResult = Schema.Struct({
  courses: Schema.Array(Course),
})

export const CanvasGetMyUpcomingAssignmentsParams = Schema.Struct({
  days: Schema.optional(Schema.Number),
})
export const CanvasGetMyUpcomingAssignmentsResult = Schema.Struct({
  items: Schema.Array(CourseWorkItem),
})

export const CanvasGetMySubmissionStatusParams = Schema.Struct({
  courseId: Schema.optional(CourseId),
})
export const CanvasGetMySubmissionStatusResult = Schema.Struct({
  submitted: Schema.Array(CourseWorkItem),
  pending: Schema.Array(CourseWorkItem),
  overdue: Schema.Array(CourseWorkItem),
})

export const CanvasStudentCourseGradeSummary = Schema.Struct({
  course: Course,
  currentScore: Schema.optional(Schema.Number),
  currentGrade: Schema.optional(Schema.String),
  finalScore: Schema.optional(Schema.Number),
  finalGrade: Schema.optional(Schema.String),
})

export const CanvasGetMyCourseGradesParams = Schema.Struct({})
export const CanvasGetMyCourseGradesResult = Schema.Struct({
  courses: Schema.Array(CanvasStudentCourseGradeSummary),
})

export const CanvasStudentTodoItem = Schema.Struct({
  courseId: Schema.optional(CourseId),
  title: Schema.String,
  type: Schema.String,
  dueAt: Schema.optional(Schema.String),
  htmlUrl: Schema.optional(Schema.String),
})

export const CanvasGetMyTodoItemsParams = Schema.Struct({})
export const CanvasGetMyTodoItemsResult = Schema.Struct({
  items: Schema.Array(CanvasStudentTodoItem),
})

export const CanvasStudentPeerReviewTodo = Schema.Struct({
  courseId: CourseId,
  assignmentId: Schema.String,
  assignmentName: Schema.String,
  revieweeUserId: Schema.optional(Schema.String),
  assessorUserId: Schema.optional(Schema.String),
  workflowState: Schema.optional(Schema.String),
})

export const CanvasGetMyPeerReviewsTodoParams = Schema.Struct({
  courseId: Schema.optional(CourseId),
})
export const CanvasGetMyPeerReviewsTodoResult = Schema.Struct({
  items: Schema.Array(CanvasStudentPeerReviewTodo),
})

export const CanvasCourseDetailsParams = Schema.Struct({
  courseId: CourseId,
})
export const CanvasCourseDetailsResult = Schema.Struct({
  course: Course,
  rawCourse: CanvasCourse,
})

export const CanvasCourseContentOverviewParams = Schema.Struct({
  courseId: Schema.optional(CourseId),
})
export const CanvasCourseContentOverviewEntry = Schema.Struct({
  course: Course,
  pageCount: Schema.Number,
  moduleCount: Schema.Number,
  moduleItemCount: Schema.Number,
  frontPage: Schema.optional(CanvasPage),
})
export const CanvasCourseContentOverviewResult = Schema.Struct({
  course: Schema.Union(Course, Schema.Undefined),
  pageCount: Schema.Number,
  moduleCount: Schema.Number,
  moduleItemCount: Schema.Number,
  frontPage: Schema.Union(CanvasPage, Schema.Undefined),
  courses: Schema.Union(Schema.Array(CanvasCourseContentOverviewEntry), Schema.Undefined),
})

export const CanvasListPagesParams = Schema.Struct({
  courseId: CourseId,
})
export const CanvasListPagesResult = Schema.Struct({
  course: Course,
  pages: Schema.Array(CanvasPage),
})

export const CanvasPageLookupParams = Schema.Struct({
  courseId: CourseId,
  pageId: Schema.String,
})
export const CanvasPageLookupResult = Schema.Struct({
  course: Course,
  page: CanvasPage,
})

export const CanvasGetFrontPageParams = Schema.Struct({
  courseId: CourseId,
})
export const CanvasGetFrontPageResult = Schema.Struct({
  course: Course,
  page: CanvasPage,
})

export const CanvasListAssignmentsParams = Schema.Struct({
  courseId: Schema.optional(CourseId),
  includeCompleted: Schema.optional(Schema.Boolean),
})
export const CanvasAssignmentsCourseBucket = Schema.Struct({
  course: Course,
  items: Schema.Array(CourseWorkItem),
})
export const CanvasListAssignmentsResult = Schema.Struct({
  course: Schema.Union(Course, Schema.Undefined),
  items: Schema.Array(CourseWorkItem),
  courses: Schema.Union(Schema.Array(CanvasAssignmentsCourseBucket), Schema.Undefined),
})

export const CanvasAssignmentDetailsParams = Schema.Struct({
  courseId: Schema.optional(Schema.Union(CourseId, Schema.Number)),
  assignmentId: Schema.optional(Schema.Union(Schema.String, Schema.Number)),
  assignmentUrl: Schema.optional(Schema.String),
  assignment_url: Schema.optional(Schema.String),
  url: Schema.optional(Schema.String),
})
export const CanvasAssignmentDetailsResult = Schema.Struct({
  course: Course,
  item: CourseWorkItem,
  source: CanvasAssignmentWithSubmission,
  grade: Schema.optional(Grade),
})

export const CanvasArchiveAssignmentParams = Schema.Struct({
  assignmentId: CourseWorkItemId,
})
export const CanvasArchiveAssignmentResult = Schema.Struct({
  archived: Schema.Literal(true),
  assignmentId: CourseWorkItemId,
})

export const CanvasUnarchiveAssignmentParams = Schema.Struct({
  assignmentId: CourseWorkItemId,
})
export const CanvasUnarchiveAssignmentResult = Schema.Struct({
  unarchived: Schema.Literal(true),
  assignmentId: CourseWorkItemId,
})

export const CanvasListModulesParams = Schema.Struct({
  courseId: CourseId,
})
export const CanvasListModulesResult = Schema.Struct({
  course: Course,
  modules: Schema.Array(CanvasModule),
})

export const CanvasListModuleItemsParams = Schema.Struct({
  courseId: CourseId,
  moduleId: Schema.String,
})
export const CanvasListModuleItemsResult = Schema.Struct({
  course: Course,
  module: CanvasModule,
  items: Schema.Array(CanvasModuleItem),
})

export const CanvasCourseStructureModule = Schema.Struct({
  module: CanvasModule,
  items: Schema.Array(CanvasModuleItem),
})
export type CanvasCourseStructureModule = Schema.Schema.Type<typeof CanvasCourseStructureModule>

export const CanvasCourseStructureParams = Schema.Struct({
  courseId: Schema.optional(CourseId),
})
export const CanvasCourseStructureCourse = Schema.Struct({
  course: Course,
  modules: Schema.Array(CanvasCourseStructureModule),
})
export const CanvasCourseStructureResult = Schema.Struct({
  course: Schema.Union(Course, Schema.Undefined),
  modules: Schema.Array(CanvasCourseStructureModule),
  courses: Schema.Union(Schema.Array(CanvasCourseStructureCourse), Schema.Undefined),
})

export const CanvasListCourseFilesParams = Schema.Struct({
  courseId: CourseId,
})
export const CanvasListCourseFilesResult = Schema.Struct({
  course: Course,
  files: Schema.Array(CanvasFile),
})

export const CanvasListDiscussionTopicsParams = Schema.Struct({
  courseId: CourseId,
})
export const CanvasListDiscussionTopicsResult = Schema.Struct({
  course: Course,
  topics: Schema.Array(CanvasDiscussionTopic),
})

export const CanvasDiscussionTopicLookupParams = Schema.Struct({
  courseId: CourseId,
  topicId: Schema.String,
})
export const CanvasDiscussionTopicLookupResult = Schema.Struct({
  course: Course,
  topic: CanvasDiscussionTopic,
})

export const CanvasListDiscussionEntriesParams = Schema.Struct({
  courseId: CourseId,
  topicId: Schema.String,
})
export const CanvasListDiscussionEntriesResult = Schema.Struct({
  course: Course,
  topic: CanvasDiscussionTopic,
  entries: Schema.Array(CanvasDiscussionEntry),
})

export const CanvasDiscussionEntryLookupParams = Schema.Struct({
  courseId: CourseId,
  topicId: Schema.String,
  entryId: Schema.String,
})
export const CanvasDiscussionEntryLookupResult = Schema.Struct({
  course: Course,
  topic: CanvasDiscussionTopic,
  entry: CanvasDiscussionEntry,
})

export const CanvasGetDiscussionWithRepliesParams = Schema.Struct({
  courseId: CourseId,
  topicId: Schema.String,
})
export const CanvasGetDiscussionWithRepliesResult = Schema.Struct({
  course: Course,
  topic: CanvasDiscussionTopic,
  entries: Schema.Array(CanvasDiscussionEntry),
})

export const CanvasListConversationsParams = Schema.Struct({
  scope: Schema.optional(Schema.Literal("unread", "starred", "archived", "sent")),
})
export const CanvasListConversationsResult = Schema.Struct({
  conversations: Schema.Array(CanvasConversation),
})

export const CanvasConversationLookupParams = Schema.Struct({
  conversationId: Schema.String,
})
export const CanvasConversationLookupResult = Schema.Struct({
  conversation: CanvasConversation,
})

export const CanvasGetUnreadCountParams = Schema.Struct({})
export const CanvasGetUnreadCountResult = Schema.Struct({
  unreadCount: Schema.Number,
})

export const CanvasSearchCanvasToolsParams = Schema.Struct({
  query: Schema.optional(Schema.String),
  category: Schema.optional(CanvasStudentToolCategory),
})
export const CanvasSearchCanvasToolsResult = Schema.Struct({
  tools: Schema.Array(CanvasStudentToolReference),
})

export const CanvasActionResult = Schema.Struct({
  success: Schema.Boolean,
  message: Schema.String,
})
export type CanvasActionResult = Schema.Schema.Type<typeof CanvasActionResult>

export const CanvasPostDiscussionEntryParams = Schema.Struct({
  courseId: CourseId,
  topicId: Schema.String,
  message: Schema.String,
})
export const CanvasPostDiscussionEntryResult = Schema.Struct({
  success: Schema.Boolean,
  courseId: CourseId,
  topicId: Schema.String,
  entry: CanvasDiscussionEntry,
  message: Schema.String,
})

export const CanvasReplyToDiscussionEntryParams = Schema.Struct({
  courseId: CourseId,
  topicId: Schema.String,
  entryId: Schema.String,
  message: Schema.String,
})
export const CanvasReplyToDiscussionEntryResult = Schema.Struct({
  success: Schema.Boolean,
  courseId: CourseId,
  topicId: Schema.String,
  entryId: Schema.String,
  reply: CanvasDiscussionEntry,
  message: Schema.String,
})

export const CanvasMarkConversationsReadParams = Schema.Struct({
  conversationIds: Schema.Array(Schema.String),
})
export const CanvasMarkConversationsReadResult = Schema.Struct({
  success: Schema.Boolean,
  conversationIds: Schema.Array(Schema.String),
  markedCount: Schema.Number,
  message: Schema.String,
})

export const CanvasDownloadCourseFileParams = Schema.Struct({
  courseId: CourseId,
  fileId: Schema.String,
  destinationPath: Schema.optional(Schema.String),
})
export const CanvasDownloadCourseFileResult = Schema.Struct({
  success: Schema.Boolean,
  courseId: CourseId,
  fileId: Schema.String,
  filename: Schema.String,
  savedPath: Schema.String,
  overwritten: Schema.Boolean,
  size: Schema.optional(Schema.Number),
  message: Schema.String,
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
  courseId: Schema.optional(CourseId),
  moduleId: Schema.optional(Schema.String),
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
export type CanvasListCoursesParams = Schema.Schema.Type<typeof CanvasListCoursesParams>
export type CanvasListCoursesResult = Schema.Schema.Type<typeof CanvasListCoursesResult>
export type CanvasGetMyUpcomingAssignmentsParams = Schema.Schema.Type<typeof CanvasGetMyUpcomingAssignmentsParams>
export type CanvasGetMyUpcomingAssignmentsResult = Schema.Schema.Type<typeof CanvasGetMyUpcomingAssignmentsResult>
export type CanvasGetMySubmissionStatusParams = Schema.Schema.Type<typeof CanvasGetMySubmissionStatusParams>
export type CanvasGetMySubmissionStatusResult = Schema.Schema.Type<typeof CanvasGetMySubmissionStatusResult>
export type CanvasStudentCourseGradeSummary = Schema.Schema.Type<typeof CanvasStudentCourseGradeSummary>
export type CanvasGetMyCourseGradesParams = Schema.Schema.Type<typeof CanvasGetMyCourseGradesParams>
export type CanvasGetMyCourseGradesResult = Schema.Schema.Type<typeof CanvasGetMyCourseGradesResult>
export type CanvasStudentTodoItem = Schema.Schema.Type<typeof CanvasStudentTodoItem>
export type CanvasGetMyTodoItemsParams = Schema.Schema.Type<typeof CanvasGetMyTodoItemsParams>
export type CanvasGetMyTodoItemsResult = Schema.Schema.Type<typeof CanvasGetMyTodoItemsResult>
export type CanvasStudentPeerReviewTodo = Schema.Schema.Type<typeof CanvasStudentPeerReviewTodo>
export type CanvasGetMyPeerReviewsTodoParams = Schema.Schema.Type<typeof CanvasGetMyPeerReviewsTodoParams>
export type CanvasGetMyPeerReviewsTodoResult = Schema.Schema.Type<typeof CanvasGetMyPeerReviewsTodoResult>
export type CanvasCourseDetailsParams = Schema.Schema.Type<typeof CanvasCourseDetailsParams>
export type CanvasCourseDetailsResult = Schema.Schema.Type<typeof CanvasCourseDetailsResult>
export type CanvasCourseContentOverviewParams = Schema.Schema.Type<typeof CanvasCourseContentOverviewParams>
export type CanvasCourseContentOverviewEntry = Schema.Schema.Type<typeof CanvasCourseContentOverviewEntry>
export type CanvasCourseContentOverviewResult = Schema.Schema.Type<typeof CanvasCourseContentOverviewResult>
export type CanvasListPagesParams = Schema.Schema.Type<typeof CanvasListPagesParams>
export type CanvasListPagesResult = Schema.Schema.Type<typeof CanvasListPagesResult>
export type CanvasPageLookupParams = Schema.Schema.Type<typeof CanvasPageLookupParams>
export type CanvasPageLookupResult = Schema.Schema.Type<typeof CanvasPageLookupResult>
export type CanvasGetFrontPageParams = Schema.Schema.Type<typeof CanvasGetFrontPageParams>
export type CanvasGetFrontPageResult = Schema.Schema.Type<typeof CanvasGetFrontPageResult>
export type CanvasListAssignmentsParams = Schema.Schema.Type<typeof CanvasListAssignmentsParams>
export type CanvasAssignmentsCourseBucket = Schema.Schema.Type<typeof CanvasAssignmentsCourseBucket>
export type CanvasListAssignmentsResult = Schema.Schema.Type<typeof CanvasListAssignmentsResult>
export type CanvasAssignmentDetailsParams = Schema.Schema.Type<typeof CanvasAssignmentDetailsParams>
export type CanvasAssignmentDetailsResult = Schema.Schema.Type<typeof CanvasAssignmentDetailsResult>
export type CanvasArchiveAssignmentParams = Schema.Schema.Type<typeof CanvasArchiveAssignmentParams>
export type CanvasArchiveAssignmentResult = Schema.Schema.Type<typeof CanvasArchiveAssignmentResult>
export type CanvasUnarchiveAssignmentParams = Schema.Schema.Type<typeof CanvasUnarchiveAssignmentParams>
export type CanvasUnarchiveAssignmentResult = Schema.Schema.Type<typeof CanvasUnarchiveAssignmentResult>
export type CanvasListModulesParams = Schema.Schema.Type<typeof CanvasListModulesParams>
export type CanvasListModulesResult = Schema.Schema.Type<typeof CanvasListModulesResult>
export type CanvasListModuleItemsParams = Schema.Schema.Type<typeof CanvasListModuleItemsParams>
export type CanvasListModuleItemsResult = Schema.Schema.Type<typeof CanvasListModuleItemsResult>
export type CanvasCourseStructureParams = Schema.Schema.Type<typeof CanvasCourseStructureParams>
export type CanvasCourseStructureCourse = Schema.Schema.Type<typeof CanvasCourseStructureCourse>
export type CanvasCourseStructureResult = Schema.Schema.Type<typeof CanvasCourseStructureResult>
export type CanvasListCourseFilesParams = Schema.Schema.Type<typeof CanvasListCourseFilesParams>
export type CanvasListCourseFilesResult = Schema.Schema.Type<typeof CanvasListCourseFilesResult>
export type CanvasListDiscussionTopicsParams = Schema.Schema.Type<typeof CanvasListDiscussionTopicsParams>
export type CanvasListDiscussionTopicsResult = Schema.Schema.Type<typeof CanvasListDiscussionTopicsResult>
export type CanvasDiscussionTopicLookupParams = Schema.Schema.Type<typeof CanvasDiscussionTopicLookupParams>
export type CanvasDiscussionTopicLookupResult = Schema.Schema.Type<typeof CanvasDiscussionTopicLookupResult>
export type CanvasListDiscussionEntriesParams = Schema.Schema.Type<typeof CanvasListDiscussionEntriesParams>
export type CanvasListDiscussionEntriesResult = Schema.Schema.Type<typeof CanvasListDiscussionEntriesResult>
export type CanvasDiscussionEntryLookupParams = Schema.Schema.Type<typeof CanvasDiscussionEntryLookupParams>
export type CanvasDiscussionEntryLookupResult = Schema.Schema.Type<typeof CanvasDiscussionEntryLookupResult>
export type CanvasGetDiscussionWithRepliesParams = Schema.Schema.Type<typeof CanvasGetDiscussionWithRepliesParams>
export type CanvasGetDiscussionWithRepliesResult = Schema.Schema.Type<typeof CanvasGetDiscussionWithRepliesResult>
export type CanvasListConversationsParams = Schema.Schema.Type<typeof CanvasListConversationsParams>
export type CanvasListConversationsResult = Schema.Schema.Type<typeof CanvasListConversationsResult>
export type CanvasConversationLookupParams = Schema.Schema.Type<typeof CanvasConversationLookupParams>
export type CanvasConversationLookupResult = Schema.Schema.Type<typeof CanvasConversationLookupResult>
export type CanvasGetUnreadCountParams = Schema.Schema.Type<typeof CanvasGetUnreadCountParams>
export type CanvasGetUnreadCountResult = Schema.Schema.Type<typeof CanvasGetUnreadCountResult>
export type CanvasSearchCanvasToolsParams = Schema.Schema.Type<typeof CanvasSearchCanvasToolsParams>
export type CanvasSearchCanvasToolsResult = Schema.Schema.Type<typeof CanvasSearchCanvasToolsResult>
export type CanvasPostDiscussionEntryParams = Schema.Schema.Type<typeof CanvasPostDiscussionEntryParams>
export type CanvasPostDiscussionEntryResult = Schema.Schema.Type<typeof CanvasPostDiscussionEntryResult>
export type CanvasReplyToDiscussionEntryParams = Schema.Schema.Type<typeof CanvasReplyToDiscussionEntryParams>
export type CanvasReplyToDiscussionEntryResult = Schema.Schema.Type<typeof CanvasReplyToDiscussionEntryResult>
export type CanvasMarkConversationsReadParams = Schema.Schema.Type<typeof CanvasMarkConversationsReadParams>
export type CanvasMarkConversationsReadResult = Schema.Schema.Type<typeof CanvasMarkConversationsReadResult>
export type CanvasDownloadCourseFileParams = Schema.Schema.Type<typeof CanvasDownloadCourseFileParams>
export type CanvasDownloadCourseFileResult = Schema.Schema.Type<typeof CanvasDownloadCourseFileResult>
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
