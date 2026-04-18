import { describe, expect, test } from "bun:test"
import {
  canvasStudentActionTools,
  canvasStudentReplacementToolInventory,
  canvasStudentResultSchemaFamilies,
  canvasStudentSelfTools,
  canvasStudentSharedReadTools,
  legacyCanvasToolNames,
} from "./student-tool-contract.js"

describe("canvas student tool contract", () => {
  test("locks the replacement student tool inventory", () => {
    const toolNames = canvasStudentReplacementToolInventory.map((tool) => tool.name)

    expect(toolNames).toEqual([
      "get_my_upcoming_assignments",
      "get_my_submission_status",
      "get_my_course_grades",
      "get_my_todo_items",
      "get_my_peer_reviews_todo",
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
      "post_discussion_entry",
      "reply_to_discussion_entry",
      "mark_conversations_read",
      "download_course_file",
    ])
  })

  test("keeps tool categories disjoint and complete", () => {
    const grouped = [
      ...canvasStudentSelfTools,
      ...canvasStudentSharedReadTools,
      ...canvasStudentActionTools,
    ]
    const uniqueNames = new Set(grouped.map((tool) => tool.name))

    expect(grouped).toHaveLength(canvasStudentReplacementToolInventory.length)
    expect(uniqueNames.size).toBe(grouped.length)
    expect(canvasStudentSelfTools.every((tool) => tool.category === "self")).toBe(true)
    expect(canvasStudentSharedReadTools.every((tool) => tool.category === "shared_read")).toBe(true)
    expect(canvasStudentActionTools.every((tool) => tool.category === "student_action")).toBe(true)
  })

  test("excludes the legacy six-tool surface from the replacement inventory", () => {
    const replacementNames = new Set(canvasStudentReplacementToolInventory.map((tool) => tool.name))

    for (const legacyToolName of legacyCanvasToolNames) {
      expect(replacementNames.has(legacyToolName)).toBe(false)
    }
  })

  test("locks the planned result schema families for later phases", () => {
    expect(canvasStudentResultSchemaFamilies).toEqual([
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
    ])
  })
})
