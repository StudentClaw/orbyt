export type CanvasStudentToolCategory = "self" | "shared_read" | "student_action"

export type CanvasStudentToolDefinition = {
  name: string
  description: string
  category: CanvasStudentToolCategory
}

export const legacyCanvasToolNames = [
  "get_courses",
  "get_coursework",
  "get_coursework_detail",
  "get_grades",
  "get_announcements",
  "sync_now",
] as const

export const canvasStudentSelfTools = [
  {
    name: "get_my_upcoming_assignments",
    description: "List upcoming assignments across the student's active Canvas courses.",
    category: "self",
  },
  {
    name: "get_my_submission_status",
    description: "Show the student's submitted, missing, and overdue assignment status.",
    category: "self",
  },
  {
    name: "get_my_course_grades",
    description: "Show the student's current grades across active Canvas courses.",
    category: "self",
  },
  {
    name: "get_my_todo_items",
    description: "List the student's current Canvas todo items.",
    category: "self",
  },
  {
    name: "get_my_peer_reviews_todo",
    description: "List peer reviews the student still needs to complete.",
    category: "self",
  },
] as const satisfies readonly CanvasStudentToolDefinition[]

export const canvasStudentSharedReadTools = [
  {
    name: "list_courses",
    description: "List Canvas courses visible to the authenticated student.",
    category: "shared_read",
  },
  {
    name: "get_course_details",
    description: "Fetch detailed information for one Canvas course.",
    category: "shared_read",
  },
  {
    name: "get_course_content_overview",
    description: "Summarize pages, modules, and syllabus content for a Canvas course.",
    category: "shared_read",
  },
  {
    name: "list_pages",
    description: "List readable pages in a Canvas course.",
    category: "shared_read",
  },
  {
    name: "get_page_content",
    description: "Fetch the readable content for a Canvas page.",
    category: "shared_read",
  },
  {
    name: "get_page_details",
    description: "Fetch metadata for a Canvas page.",
    category: "shared_read",
  },
  {
    name: "get_front_page",
    description: "Fetch the front page for a Canvas course when it is visible to the student.",
    category: "shared_read",
  },
  {
    name: "list_assignments",
    description: "List assignments visible to the student in a Canvas course.",
    category: "shared_read",
  },
  {
    name: "get_assignment_details",
    description: "Fetch details for a Canvas assignment visible to the student from IDs or a full Canvas assignment URL.",
    category: "shared_read",
  },
  {
    name: "list_modules",
    description: "List readable modules in a Canvas course.",
    category: "shared_read",
  },
  {
    name: "list_module_items",
    description: "List readable module items for a Canvas module.",
    category: "shared_read",
  },
  {
    name: "get_course_structure",
    description: "Return the readable module and item structure for a Canvas course.",
    category: "shared_read",
  },
  {
    name: "list_course_files",
    description: "List Canvas files visible to the student in a course.",
    category: "shared_read",
  },
  {
    name: "list_discussion_topics",
    description: "List discussion topics visible to the student in a Canvas course.",
    category: "shared_read",
  },
  {
    name: "get_discussion_topic_details",
    description: "Fetch metadata for a readable Canvas discussion topic.",
    category: "shared_read",
  },
  {
    name: "list_discussion_entries",
    description: "List readable entries for a Canvas discussion topic.",
    category: "shared_read",
  },
  {
    name: "get_discussion_entry_details",
    description: "Fetch details for a readable Canvas discussion entry.",
    category: "shared_read",
  },
  {
    name: "get_discussion_with_replies",
    description: "Fetch a Canvas discussion topic with its visible replies.",
    category: "shared_read",
  },
  {
    name: "list_conversations",
    description: "List Canvas conversations visible to the student.",
    category: "shared_read",
  },
  {
    name: "get_conversation_details",
    description: "Fetch details for a Canvas conversation visible to the student.",
    category: "shared_read",
  },
  {
    name: "get_unread_count",
    description: "Fetch the student's unread Canvas conversation count.",
    category: "shared_read",
  },
  {
    name: "search_canvas_tools",
    description: "Discover the student-facing Canvas MCP tool surface.",
    category: "shared_read",
  },
] as const satisfies readonly CanvasStudentToolDefinition[]

export const canvasStudentActionTools = [
  {
    name: "post_discussion_entry",
    description: "Post a new entry to a Canvas discussion when the student is allowed to participate.",
    category: "student_action",
  },
  {
    name: "reply_to_discussion_entry",
    description: "Reply to a Canvas discussion entry when the student is allowed to participate.",
    category: "student_action",
  },
  {
    name: "mark_conversations_read",
    description: "Mark one or more Canvas conversations as read.",
    category: "student_action",
  },
  {
    name: "download_course_file",
    description: "Download a readable Canvas file into the active workspace or another allowed writable path.",
    category: "student_action",
  },
] as const satisfies readonly CanvasStudentToolDefinition[]

export const canvasStudentReplacementToolInventory = [
  ...canvasStudentSelfTools,
  ...canvasStudentSharedReadTools,
  ...canvasStudentActionTools,
] as const satisfies readonly CanvasStudentToolDefinition[]

export const canvasStudentResultSchemaFamilies = [
  "student_self_summary",
  "student_submission_status",
  "student_course_grades",
  "student_todo",
  "student_peer_review_todo",
  "student_course_read",
  "student_content_read",
  "student_assignment_read",
  "student_discussion_read",
  "student_conversation_read",
  "student_action_result",
  "student_file_download",
] as const
