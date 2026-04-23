export const LOGICAL_CAPABILITY_KEYS = [
  "canvas.self.read",
  "canvas.shared.read",
  "canvas.files.download",
  "canvas.student.write",
  "calendar.calendars.read",
  "calendar.events.read",
  "calendar.events.write",
  "calendar.calendars.write",
  "memory.read",
] as const

export type LogicalCapabilityKey = (typeof LOGICAL_CAPABILITY_KEYS)[number]

const READ_ONLY_KEYS = new Set<LogicalCapabilityKey>([
  "canvas.self.read",
  "canvas.shared.read",
  "calendar.calendars.read",
  "calendar.events.read",
  "memory.read",
])

type ToolMapping = {
  readonly server: string
  readonly toolName: string
  readonly capabilityKeys: readonly LogicalCapabilityKey[]
}

const CANVAS_SELF_READ: readonly string[] = [
  "get_my_upcoming_assignments",
  "get_my_submission_status",
  "get_my_course_grades",
  "get_my_todo_items",
  "get_my_peer_reviews_todo",
]

const CANVAS_SHARED_READ: readonly string[] = [
  "list_courses",
  "get_course_details",
  "get_course_content_overview",
  "list_pages",
  "get_page_content",
  "get_page_details",
  "get_front_page",
  "list_assignments",
  "get_assignment_details",
  "list_modules",
  "list_module_items",
  "get_course_structure",
  "list_course_files",
  "list_discussion_topics",
  "get_discussion_topic_details",
  "list_discussion_entries",
  "get_discussion_entry_details",
  "get_discussion_with_replies",
  "list_conversations",
  "get_conversation_details",
  "get_unread_count",
  "search_canvas_tools",
]

const CANVAS_FILE_DOWNLOAD: readonly string[] = ["download_course_file"]

const CANVAS_STUDENT_WRITE: readonly string[] = [
  "post_discussion_entry",
  "reply_to_discussion_entry",
  "mark_conversations_read",
]

const APPLE_CALENDAR_READ_CALENDARS: readonly string[] = ["getCalendars"]
const APPLE_CALENDAR_READ_EVENTS: readonly string[] = ["getCalendarEvents"]
const APPLE_CALENDAR_WRITE_EVENTS: readonly string[] = [
  "createCalendarEvent",
  "updateCalendarEvent",
  "deleteCalendarEvent",
]
const APPLE_CALENDAR_WRITE_CALENDARS: readonly string[] = ["createCalendar", "deleteCalendar"]

function entries(
  server: string,
  toolNames: readonly string[],
  key: LogicalCapabilityKey,
): readonly ToolMapping[] {
  return toolNames.map((toolName) => ({ server, toolName, capabilityKeys: [key] }))
}

const MAPPINGS: readonly ToolMapping[] = [
  ...entries("canvas-mcp", CANVAS_SELF_READ, "canvas.self.read"),
  ...entries("canvas-mcp", CANVAS_SHARED_READ, "canvas.shared.read"),
  ...entries("canvas-mcp", CANVAS_FILE_DOWNLOAD, "canvas.files.download"),
  ...entries("canvas-mcp", CANVAS_STUDENT_WRITE, "canvas.student.write"),
  ...entries("apple-calendar-mcp", APPLE_CALENDAR_READ_CALENDARS, "calendar.calendars.read"),
  ...entries("apple-calendar-mcp", APPLE_CALENDAR_READ_EVENTS, "calendar.events.read"),
  ...entries("apple-calendar-mcp", APPLE_CALENDAR_WRITE_EVENTS, "calendar.events.write"),
  ...entries("apple-calendar-mcp", APPLE_CALENDAR_WRITE_CALENDARS, "calendar.calendars.write"),
]

const LOOKUP = new Map<string, readonly LogicalCapabilityKey[]>()
for (const mapping of MAPPINGS) {
  LOOKUP.set(`${mapping.server}::${mapping.toolName}`, mapping.capabilityKeys)
}

export function logicalKeysForTool(
  mcpServerId: string,
  toolName: string,
): readonly LogicalCapabilityKey[] {
  return LOOKUP.get(`${mcpServerId}::${toolName}`) ?? []
}

export function isReadOnlyCapabilityKey(key: string): boolean {
  return READ_ONLY_KEYS.has(key as LogicalCapabilityKey)
}

export function isKnownCapabilityKey(key: string): key is LogicalCapabilityKey {
  return (LOGICAL_CAPABILITY_KEYS as readonly string[]).includes(key)
}
