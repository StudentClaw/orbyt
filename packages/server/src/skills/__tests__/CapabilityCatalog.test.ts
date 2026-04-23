import { describe, test, expect } from "bun:test"
import { logicalKeysForTool, isReadOnlyCapabilityKey } from "../CapabilityCatalog.js"

describe("CapabilityCatalog.logicalKeysForTool", () => {
  test("maps canvas shared reads to canvas.shared.read", () => {
    expect(logicalKeysForTool("canvas-mcp", "get_page_content")).toEqual(["canvas.shared.read"])
    expect(logicalKeysForTool("canvas-mcp", "list_modules")).toEqual(["canvas.shared.read"])
  })

  test("maps canvas self-scoped reads to canvas.self.read", () => {
    expect(logicalKeysForTool("canvas-mcp", "get_my_upcoming_assignments")).toEqual(["canvas.self.read"])
  })

  test("maps canvas file download to canvas.files.download and flags it non-read-only", () => {
    expect(logicalKeysForTool("canvas-mcp", "download_course_file")).toEqual(["canvas.files.download"])
  })

  test("maps canvas student-write actions to canvas.student.write", () => {
    expect(logicalKeysForTool("canvas-mcp", "post_discussion_entry")).toEqual(["canvas.student.write"])
    expect(logicalKeysForTool("canvas-mcp", "mark_conversations_read")).toEqual(["canvas.student.write"])
  })

  test("maps Apple Calendar getCalendars / events read / events write / calendars write", () => {
    expect(logicalKeysForTool("apple-calendar-mcp", "getCalendars")).toEqual(["calendar.calendars.read"])
    expect(logicalKeysForTool("apple-calendar-mcp", "getCalendarEvents")).toEqual(["calendar.events.read"])
    expect(logicalKeysForTool("apple-calendar-mcp", "createCalendarEvent")).toEqual(["calendar.events.write"])
    expect(logicalKeysForTool("apple-calendar-mcp", "deleteCalendar")).toEqual(["calendar.calendars.write"])
  })

  test("returns empty list for unknown tools so the gate can apply a safe default", () => {
    expect(logicalKeysForTool("canvas-mcp", "tool_that_does_not_exist")).toEqual([])
    expect(logicalKeysForTool("some-other-server", "anything")).toEqual([])
  })

  test("classifies read capabilities as read-only and write/download/mutate as not read-only", () => {
    expect(isReadOnlyCapabilityKey("canvas.shared.read")).toBe(true)
    expect(isReadOnlyCapabilityKey("canvas.self.read")).toBe(true)
    expect(isReadOnlyCapabilityKey("calendar.events.read")).toBe(true)
    expect(isReadOnlyCapabilityKey("calendar.calendars.read")).toBe(true)
    expect(isReadOnlyCapabilityKey("canvas.files.download")).toBe(false)
    expect(isReadOnlyCapabilityKey("canvas.student.write")).toBe(false)
    expect(isReadOnlyCapabilityKey("calendar.events.write")).toBe(false)
    expect(isReadOnlyCapabilityKey("calendar.calendars.write")).toBe(false)
  })
})
