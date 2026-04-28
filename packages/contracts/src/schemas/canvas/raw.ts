import { Schema } from "@effect/schema"

export const CanvasUser = Schema.Struct({
  id: Schema.Number,
  name: Schema.optional(Schema.NullOr(Schema.String)),
  display_name: Schema.optional(Schema.NullOr(Schema.String)),
  sortable_name: Schema.optional(Schema.NullOr(Schema.String)),
  short_name: Schema.optional(Schema.NullOr(Schema.String)),
  avatar_url: Schema.optional(Schema.NullOr(Schema.String)),
  avatar_image_url: Schema.optional(Schema.NullOr(Schema.String)),
})
export type CanvasUser = Schema.Schema.Type<typeof CanvasUser>

export const CanvasTerm = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  start_at: Schema.optional(Schema.NullOr(Schema.String)),
  end_at: Schema.optional(Schema.NullOr(Schema.String)),
  created_at: Schema.optional(Schema.NullOr(Schema.String)),
})
export type CanvasTerm = Schema.Schema.Type<typeof CanvasTerm>

export const CanvasCourse = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  course_code: Schema.optional(Schema.NullOr(Schema.String)),
  workflow_state: Schema.optional(Schema.NullOr(Schema.String)),
  account_id: Schema.optional(Schema.NullOr(Schema.Number)),
  sis_course_id: Schema.optional(Schema.NullOr(Schema.String)),
  integration_id: Schema.optional(Schema.NullOr(Schema.String)),
  enrollment_term_id: Schema.optional(Schema.NullOr(Schema.Number)),
  start_at: Schema.optional(Schema.NullOr(Schema.String)),
  end_at: Schema.optional(Schema.NullOr(Schema.String)),
  term: Schema.optional(Schema.NullOr(CanvasTerm)),
  teacher: Schema.optional(Schema.NullOr(CanvasUser)),
  teachers: Schema.optional(Schema.NullOr(Schema.Array(CanvasUser))),
  created_at: Schema.optional(Schema.NullOr(Schema.String)),
  updated_at: Schema.optional(Schema.NullOr(Schema.String)),
  uuid: Schema.optional(Schema.NullOr(Schema.String)),
})
export type CanvasCourse = Schema.Schema.Type<typeof CanvasCourse>

export const CanvasEnrollmentGrade = Schema.Struct({
  current_score: Schema.optional(Schema.NullOr(Schema.Number)),
  final_score: Schema.optional(Schema.NullOr(Schema.Number)),
  current_grade: Schema.optional(Schema.NullOr(Schema.String)),
  final_grade: Schema.optional(Schema.NullOr(Schema.String)),
  unposted_current_score: Schema.optional(Schema.NullOr(Schema.Number)),
  unposted_final_score: Schema.optional(Schema.NullOr(Schema.Number)),
  unposted_current_grade: Schema.optional(Schema.NullOr(Schema.String)),
  unposted_final_grade: Schema.optional(Schema.NullOr(Schema.String)),
  current_points: Schema.optional(Schema.NullOr(Schema.Number)),
  unposted_current_points: Schema.optional(Schema.NullOr(Schema.Number)),
  grading_period_id: Schema.optional(Schema.NullOr(Schema.Number)),
  html_url: Schema.optional(Schema.String),
})
export type CanvasEnrollmentGrade = Schema.Schema.Type<typeof CanvasEnrollmentGrade>

export const CanvasEnrollment = Schema.Struct({
  id: Schema.optional(Schema.Number),
  course_id: Schema.optional(Schema.Number),
  user_id: Schema.optional(Schema.Number),
  type: Schema.String,
  role: Schema.optional(Schema.String),
  enrollment_state: Schema.String,
  grades: Schema.optional(CanvasEnrollmentGrade),
  has_grading_periods: Schema.optional(Schema.NullOr(Schema.Boolean)),
  totals_for_all_grading_periods_option: Schema.optional(Schema.NullOr(Schema.Boolean)),
  current_grading_period_title: Schema.optional(Schema.NullOr(Schema.String)),
  current_grading_period_id: Schema.optional(Schema.NullOr(Schema.Number)),
  computed_current_score: Schema.optional(Schema.NullOr(Schema.Number)),
  computed_final_score: Schema.optional(Schema.NullOr(Schema.Number)),
  computed_current_grade: Schema.optional(Schema.NullOr(Schema.String)),
  computed_final_grade: Schema.optional(Schema.NullOr(Schema.String)),
  current_period_computed_current_score: Schema.optional(Schema.NullOr(Schema.Number)),
  current_period_computed_final_score: Schema.optional(Schema.NullOr(Schema.Number)),
  current_period_computed_current_grade: Schema.optional(Schema.NullOr(Schema.String)),
  current_period_computed_final_grade: Schema.optional(Schema.NullOr(Schema.String)),
  current_period_unposted_current_score: Schema.optional(Schema.NullOr(Schema.Number)),
  current_period_unposted_final_score: Schema.optional(Schema.NullOr(Schema.Number)),
  current_period_unposted_current_grade: Schema.optional(Schema.NullOr(Schema.String)),
  current_period_unposted_final_grade: Schema.optional(Schema.NullOr(Schema.String)),
  created_at: Schema.optional(Schema.NullOr(Schema.String)),
  updated_at: Schema.optional(Schema.NullOr(Schema.String)),
  start_at: Schema.optional(Schema.NullOr(Schema.String)),
  end_at: Schema.optional(Schema.NullOr(Schema.String)),
})
export type CanvasEnrollment = Schema.Schema.Type<typeof CanvasEnrollment>

export const CanvasCourseWithEnrollments = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  course_code: Schema.optional(Schema.NullOr(Schema.String)),
  workflow_state: Schema.optional(Schema.NullOr(Schema.String)),
  account_id: Schema.optional(Schema.NullOr(Schema.Number)),
  sis_course_id: Schema.optional(Schema.NullOr(Schema.String)),
  integration_id: Schema.optional(Schema.NullOr(Schema.String)),
  enrollment_term_id: Schema.optional(Schema.NullOr(Schema.Number)),
  start_at: Schema.optional(Schema.NullOr(Schema.String)),
  end_at: Schema.optional(Schema.NullOr(Schema.String)),
  term: Schema.optional(Schema.NullOr(CanvasTerm)),
  teacher: Schema.optional(Schema.NullOr(CanvasUser)),
  teachers: Schema.optional(Schema.NullOr(Schema.Array(CanvasUser))),
  enrollments: Schema.optional(Schema.NullOr(Schema.Array(CanvasEnrollment))),
  credits: Schema.optional(Schema.NullOr(Schema.Number)),
  created_at: Schema.optional(Schema.NullOr(Schema.String)),
  updated_at: Schema.optional(Schema.NullOr(Schema.String)),
  uuid: Schema.optional(Schema.NullOr(Schema.String)),
})
export type CanvasCourseWithEnrollments = Schema.Schema.Type<typeof CanvasCourseWithEnrollments>

export const CanvasAssignment = Schema.Struct({
  id: Schema.Number,
  course_id: Schema.Number,
  name: Schema.String,
  description: Schema.optional(Schema.NullOr(Schema.String)),
  due_at: Schema.optional(Schema.NullOr(Schema.String)),
  unlock_at: Schema.optional(Schema.NullOr(Schema.String)),
  lock_at: Schema.optional(Schema.NullOr(Schema.String)),
  points_possible: Schema.optional(Schema.NullOr(Schema.Number)),
  submission_types: Schema.optional(Schema.Array(Schema.String)),
  published: Schema.optional(Schema.Boolean),
  html_url: Schema.optional(Schema.String),
  created_at: Schema.optional(Schema.NullOr(Schema.String)),
  updated_at: Schema.optional(Schema.NullOr(Schema.String)),
  assignment_group_id: Schema.optional(Schema.Number),
  has_submitted_submissions: Schema.optional(Schema.Boolean),
  graded_submissions_exist: Schema.optional(Schema.Boolean),
  allowed_attempts: Schema.optional(Schema.NullOr(Schema.Number)),
})
export type CanvasAssignment = Schema.Schema.Type<typeof CanvasAssignment>

export const CanvasSubmission = Schema.Struct({
  id: Schema.optional(Schema.NullOr(Schema.Number)),
  assignment_id: Schema.Number,
  course_id: Schema.optional(Schema.NullOr(Schema.Number)),
  user_id: Schema.optional(Schema.NullOr(Schema.Number)),
  score: Schema.optional(Schema.NullOr(Schema.Number)),
  grade: Schema.optional(Schema.NullOr(Schema.String)),
  submitted_at: Schema.optional(Schema.NullOr(Schema.String)),
  workflow_state: Schema.optional(Schema.NullOr(Schema.String)),
  late: Schema.optional(Schema.NullOr(Schema.Boolean)),
  missing: Schema.optional(Schema.NullOr(Schema.Boolean)),
  excused: Schema.optional(Schema.NullOr(Schema.Boolean)),
  attempt: Schema.optional(Schema.NullOr(Schema.Number)),
  posted_at: Schema.optional(Schema.NullOr(Schema.String)),
  html_url: Schema.optional(Schema.NullOr(Schema.String)),
  updated_at: Schema.optional(Schema.NullOr(Schema.String)),
  cached_due_date: Schema.optional(Schema.NullOr(Schema.String)),
})
export type CanvasSubmission = Schema.Schema.Type<typeof CanvasSubmission>

export const CanvasAssignmentWithSubmission = Schema.Struct({
  id: Schema.Number,
  course_id: Schema.Number,
  name: Schema.String,
  description: Schema.optional(Schema.NullOr(Schema.String)),
  due_at: Schema.optional(Schema.NullOr(Schema.String)),
  unlock_at: Schema.optional(Schema.NullOr(Schema.String)),
  lock_at: Schema.optional(Schema.NullOr(Schema.String)),
  points_possible: Schema.optional(Schema.NullOr(Schema.Number)),
  submission_types: Schema.optional(Schema.Array(Schema.String)),
  published: Schema.optional(Schema.Boolean),
  html_url: Schema.optional(Schema.String),
  created_at: Schema.optional(Schema.NullOr(Schema.String)),
  updated_at: Schema.optional(Schema.NullOr(Schema.String)),
  assignment_group_id: Schema.optional(Schema.Number),
  has_submitted_submissions: Schema.optional(Schema.Boolean),
  graded_submissions_exist: Schema.optional(Schema.Boolean),
  allowed_attempts: Schema.optional(Schema.NullOr(Schema.Number)),
  peer_reviews: Schema.optional(Schema.Boolean),
  submission: Schema.optional(Schema.NullOr(CanvasSubmission)),
})
export type CanvasAssignmentWithSubmission = Schema.Schema.Type<typeof CanvasAssignmentWithSubmission>

export const CanvasUpcomingEventAssignment = Schema.Struct({
  id: Schema.Number,
  course_id: Schema.Number,
  name: Schema.String,
  due_at: Schema.optional(Schema.NullOr(Schema.String)),
  points_possible: Schema.optional(Schema.NullOr(Schema.Number)),
  html_url: Schema.optional(Schema.NullOr(Schema.String)),
  updated_at: Schema.optional(Schema.NullOr(Schema.String)),
})
export type CanvasUpcomingEventAssignment = Schema.Schema.Type<typeof CanvasUpcomingEventAssignment>

export const CanvasUpcomingEvent = Schema.Struct({
  id: Schema.optional(Schema.NullOr(Schema.Union(Schema.Number, Schema.String))),
  title: Schema.optional(Schema.NullOr(Schema.String)),
  name: Schema.optional(Schema.NullOr(Schema.String)),
  type: Schema.optional(Schema.NullOr(Schema.String)),
  course_id: Schema.optional(Schema.NullOr(Schema.Union(Schema.Number, Schema.String))),
  html_url: Schema.optional(Schema.NullOr(Schema.String)),
  due_at: Schema.optional(Schema.NullOr(Schema.String)),
  points_possible: Schema.optional(Schema.NullOr(Schema.Number)),
  updated_at: Schema.optional(Schema.NullOr(Schema.String)),
  assignment: Schema.optional(Schema.NullOr(CanvasUpcomingEventAssignment)),
})
export type CanvasUpcomingEvent = Schema.Schema.Type<typeof CanvasUpcomingEvent>

export const CanvasTodoItem = Schema.Struct({
  type: Schema.optional(Schema.NullOr(Schema.String)),
  course_id: Schema.optional(Schema.NullOr(Schema.Number)),
  html_url: Schema.optional(Schema.NullOr(Schema.String)),
  title: Schema.optional(Schema.NullOr(Schema.String)),
  assignment: Schema.optional(Schema.NullOr(CanvasUpcomingEventAssignment)),
})
export type CanvasTodoItem = Schema.Schema.Type<typeof CanvasTodoItem>

export const CanvasPeerReview = Schema.Struct({
  user_id: Schema.optional(Schema.NullOr(Schema.Number)),
  assessor_id: Schema.optional(Schema.NullOr(Schema.Number)),
  workflow_state: Schema.optional(Schema.NullOr(Schema.String)),
})
export type CanvasPeerReview = Schema.Schema.Type<typeof CanvasPeerReview>

export const CanvasModuleCompletionRequirement = Schema.Struct({
  type: Schema.String,
  completed: Schema.optional(Schema.Boolean),
  count: Schema.optional(Schema.Number),
  min_score: Schema.optional(Schema.Number),
})
export type CanvasModuleCompletionRequirement = Schema.Schema.Type<typeof CanvasModuleCompletionRequirement>

export const CanvasModule = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  position: Schema.optional(Schema.Number),
  unlock_at: Schema.optional(Schema.NullOr(Schema.String)),
  require_sequential_progress: Schema.optional(Schema.Boolean),
  published: Schema.optional(Schema.Boolean),
  items_count: Schema.optional(Schema.Number),
  items_url: Schema.optional(Schema.String),
  state: Schema.optional(Schema.String),
  prerequisite_module_ids: Schema.optional(Schema.Array(Schema.Number)),
  completion_requirements: Schema.optional(Schema.Array(CanvasModuleCompletionRequirement)),
})
export type CanvasModule = Schema.Schema.Type<typeof CanvasModule>

export const CanvasModuleItemCompletionRequirement = Schema.Struct({
  type: Schema.String,
  completed: Schema.optional(Schema.Boolean),
})
export type CanvasModuleItemCompletionRequirement = Schema.Schema.Type<typeof CanvasModuleItemCompletionRequirement>

export const CanvasModuleItem = Schema.Struct({
  id: Schema.Number,
  module_id: Schema.Number,
  position: Schema.optional(Schema.Number),
  title: Schema.String,
  indent: Schema.optional(Schema.Number),
  type: Schema.Literal(
    "File",
    "Page",
    "Discussion",
    "Assignment",
    "Quiz",
    "SubHeader",
    "ExternalUrl",
    "ExternalTool",
  ),
  content_id: Schema.optional(Schema.Number),
  html_url: Schema.optional(Schema.String),
  url: Schema.optional(Schema.String),
  published: Schema.optional(Schema.Boolean),
  completion_requirement: Schema.optional(CanvasModuleItemCompletionRequirement),
  updated_at: Schema.optional(Schema.NullOr(Schema.String)),
})
export type CanvasModuleItem = Schema.Schema.Type<typeof CanvasModuleItem>

export const CanvasPage = Schema.Struct({
  page_id: Schema.Number,
  url: Schema.String,
  title: Schema.String,
  body: Schema.optional(Schema.NullOr(Schema.String)),
  published: Schema.optional(Schema.Boolean),
  front_page: Schema.optional(Schema.Boolean),
  created_at: Schema.optional(Schema.NullOr(Schema.String)),
  updated_at: Schema.optional(Schema.NullOr(Schema.String)),
  html_url: Schema.optional(Schema.String),
})
export type CanvasPage = Schema.Schema.Type<typeof CanvasPage>

export const CanvasAttachment = Schema.Struct({
  id: Schema.Number,
  display_name: Schema.String,
  filename: Schema.String,
  content_type: Schema.optional(Schema.String),
  url: Schema.optional(Schema.String),
  size: Schema.optional(Schema.Number),
})
export type CanvasAttachment = Schema.Schema.Type<typeof CanvasAttachment>

export const CanvasFile = Schema.Struct({
  id: Schema.Number,
  uuid: Schema.optional(Schema.NullOr(Schema.String)),
  folder_id: Schema.optional(Schema.NullOr(Schema.Number)),
  display_name: Schema.String,
  filename: Schema.String,
  "content-type": Schema.optional(Schema.NullOr(Schema.String)),
  url: Schema.optional(Schema.NullOr(Schema.String)),
  size: Schema.optional(Schema.NullOr(Schema.Number)),
  created_at: Schema.optional(Schema.NullOr(Schema.String)),
  updated_at: Schema.optional(Schema.NullOr(Schema.String)),
  unlock_at: Schema.optional(Schema.NullOr(Schema.String)),
  lock_at: Schema.optional(Schema.NullOr(Schema.String)),
  locked: Schema.optional(Schema.Boolean),
  hidden: Schema.optional(Schema.Boolean),
  hidden_for_user: Schema.optional(Schema.Boolean),
  visibility_level: Schema.optional(Schema.NullOr(Schema.String)),
  thumbnail_url: Schema.optional(Schema.NullOr(Schema.String)),
  mime_class: Schema.optional(Schema.NullOr(Schema.String)),
})
export type CanvasFile = Schema.Schema.Type<typeof CanvasFile>

export const CanvasAnnouncement = Schema.Struct({
  id: Schema.Number,
  context_code: Schema.String,
  title: Schema.String,
  message: Schema.optional(Schema.NullOr(Schema.String)),
  posted_at: Schema.optional(Schema.NullOr(Schema.String)),
  created_at: Schema.optional(Schema.NullOr(Schema.String)),
  updated_at: Schema.optional(Schema.NullOr(Schema.String)),
  delayed_post_at: Schema.optional(Schema.NullOr(Schema.String)),
  lock_at: Schema.optional(Schema.NullOr(Schema.String)),
  html_url: Schema.optional(Schema.String),
  attachments: Schema.optional(Schema.Array(CanvasAttachment)),
})
export type CanvasAnnouncement = Schema.Schema.Type<typeof CanvasAnnouncement>

export const CanvasDiscussionTopic = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  message: Schema.optional(Schema.NullOr(Schema.String)),
  html_url: Schema.optional(Schema.NullOr(Schema.String)),
  posted_at: Schema.optional(Schema.NullOr(Schema.String)),
  delayed_post_at: Schema.optional(Schema.NullOr(Schema.String)),
  last_reply_at: Schema.optional(Schema.NullOr(Schema.String)),
  lock_at: Schema.optional(Schema.NullOr(Schema.String)),
  discussion_subentry_count: Schema.optional(Schema.NullOr(Schema.Number)),
  read_state: Schema.optional(Schema.NullOr(Schema.String)),
  unread_count: Schema.optional(Schema.NullOr(Schema.Number)),
  assignment_id: Schema.optional(Schema.NullOr(Schema.Number)),
  pinned: Schema.optional(Schema.Boolean),
  locked: Schema.optional(Schema.Boolean),
})
export type CanvasDiscussionTopic = Schema.Schema.Type<typeof CanvasDiscussionTopic>

export const CanvasDiscussionEntry: Schema.Schema<any> = Schema.suspend(() =>
  Schema.Struct({
    id: Schema.Number,
    user_id: Schema.optional(Schema.NullOr(Schema.Number)),
    editor_id: Schema.optional(Schema.NullOr(Schema.Number)),
    user_name: Schema.optional(Schema.NullOr(Schema.String)),
    message: Schema.optional(Schema.NullOr(Schema.String)),
    read_state: Schema.optional(Schema.NullOr(Schema.String)),
    forced_read_state: Schema.optional(Schema.Boolean),
    created_at: Schema.optional(Schema.NullOr(Schema.String)),
    updated_at: Schema.optional(Schema.NullOr(Schema.String)),
    attachment: Schema.optional(Schema.NullOr(CanvasAttachment)),
    attachments: Schema.optional(Schema.Array(CanvasAttachment)),
    recent_replies: Schema.optional(Schema.Array(CanvasDiscussionEntry)),
  }),
)
export type CanvasDiscussionEntry = Schema.Schema.Type<typeof CanvasDiscussionEntry>

export const CanvasDiscussionView = Schema.Struct({
  participants: Schema.optional(Schema.Array(CanvasUser)),
  unread_entries: Schema.optional(Schema.Array(Schema.Number)),
  forced_entries: Schema.optional(Schema.Array(Schema.Number)),
  view: Schema.optional(Schema.Array(CanvasDiscussionEntry)),
  new_entries: Schema.optional(Schema.Array(CanvasDiscussionEntry)),
})
export type CanvasDiscussionView = Schema.Schema.Type<typeof CanvasDiscussionView>

export const CanvasConversation = Schema.Struct({
  id: Schema.Number,
  subject: Schema.optional(Schema.NullOr(Schema.String)),
  workflow_state: Schema.optional(Schema.NullOr(Schema.String)),
  last_message: Schema.optional(Schema.NullOr(Schema.String)),
  last_authored_message: Schema.optional(Schema.NullOr(Schema.String)),
  last_message_at: Schema.optional(Schema.NullOr(Schema.String)),
  message_count: Schema.optional(Schema.NullOr(Schema.Number)),
  subscribed: Schema.optional(Schema.Boolean),
  private: Schema.optional(Schema.Boolean),
  starred: Schema.optional(Schema.Boolean),
  audience: Schema.optional(Schema.Array(Schema.Number)),
  avatar_url: Schema.optional(Schema.NullOr(Schema.String)),
  visible: Schema.optional(Schema.Boolean),
  context_code: Schema.optional(Schema.NullOr(Schema.String)),
})
export type CanvasConversation = Schema.Schema.Type<typeof CanvasConversation>

export const CanvasUnreadCount = Schema.Struct({
  unread_count: Schema.Union(Schema.String, Schema.Number),
})
export type CanvasUnreadCount = Schema.Schema.Type<typeof CanvasUnreadCount>

export const CanvasRawCourseworkSource = Schema.Union(
  CanvasAssignment,
  CanvasModuleItem,
  CanvasPage,
  CanvasAnnouncement,
)
export type CanvasRawCourseworkSource = Schema.Schema.Type<typeof CanvasRawCourseworkSource>
