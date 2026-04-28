import { describe, test, expect } from "bun:test"
import {
  buildHeartbeatPrompt,
  parseAgentDirectives,
  checkHeartbeatAck,
} from "../prompts.js"

const EMPTY_SCHEDULE = {
  upcomingCoursework: [],
  todaysSessions: [],
} as const

describe("buildHeartbeatPrompt", () => {
  test("includes scope, working buffer, schedule sections, and reply protocol", () => {
    const prompt = buildHeartbeatPrompt({
      heartbeatScope: "watch for missed deadlines",
      workingBufferNotes: [],
      nowIso: "2026-04-24T12:00:00.000Z",
      ...EMPTY_SCHEDULE,
    })
    expect(prompt).toContain("HEARTBEAT_OK")
    expect(prompt).toContain("WB_ADD")
    expect(prompt).toContain("REMINDER:")
    expect(prompt).toContain("watch for missed deadlines")
    expect(prompt).toContain("(no active notes)")
    expect(prompt).toContain("(no upcoming items)")
    expect(prompt).toContain("(no sessions today)")
    expect(prompt).toContain("2026-04-24T12:00:00.000Z")
  })

  test("renders working-buffer notes inline", () => {
    const prompt = buildHeartbeatPrompt({
      heartbeatScope: "",
      workingBufferNotes: [
        {
          id: "wb_1",
          plantedAt: "2026-04-24T10:00:00.000Z",
          expiresAt: "2026-04-25T10:00:00.000Z",
          text: "watch CS",
        },
      ],
      nowIso: "2026-04-24T12:00:00.000Z",
      ...EMPTY_SCHEDULE,
    })
    expect(prompt).toContain("watch CS")
    expect(prompt).toContain("expires 2026-04-25T10:00:00.000Z")
  })

  test("renders upcoming coursework and today's sessions when present", () => {
    const prompt = buildHeartbeatPrompt({
      heartbeatScope: "",
      workingBufferNotes: [],
      nowIso: "2026-04-24T12:00:00.000Z",
      upcomingCoursework: [
        { course: "CS-101", title: "Lab 4", dueAt: "2026-04-25T05:00:00.000Z" },
        { course: "MATH-201", title: "Problem set", dueAt: null },
      ],
      todaysSessions: [
        {
          start: "2026-04-24T14:00:00.000Z",
          end: "2026-04-24T15:30:00.000Z",
          title: "Calc study",
        },
      ],
    })
    expect(prompt).toContain("CS-101: Lab 4 (due 2026-04-25T05:00:00.000Z)")
    expect(prompt).toContain("MATH-201: Problem set")
    expect(prompt).toContain(
      "2026-04-24T14:00:00.000Z–2026-04-24T15:30:00.000Z Calc study",
    )
  })
})

describe("parseAgentDirectives", () => {
  test("extracts well-formed WB_ADD lines and removes them from the reply", () => {
    const result = parseAgentDirectives(
      "Saw stress about CS exam.\nWB_ADD: ttl=24 | watch CS-related signals\nKeep an eye on Friday.\nWB_ADD: ttl=12 | follow up Friday",
    )
    expect(result.notes).toEqual([
      { ttlHours: 24, text: "watch CS-related signals" },
      { ttlHours: 12, text: "follow up Friday" },
    ])
    expect(result.reminders).toHaveLength(0)
    expect(result.cleanedReply).toBe(
      "Saw stress about CS exam.\nKeep an eye on Friday.",
    )
  })

  test("ignores malformed WB_ADD lines (kept as plain text)", () => {
    const result = parseAgentDirectives("WB_ADD: not a directive at all")
    expect(result.notes).toHaveLength(0)
    expect(result.cleanedReply).toBe("WB_ADD: not a directive at all")
  })

  test("rejects WB_ADD with non-positive TTL", () => {
    const result = parseAgentDirectives("WB_ADD: ttl=0 | bad note")
    expect(result.notes).toHaveLength(0)
  })

  test("extracts REMINDER lines and strips them from the reply", () => {
    const result = parseAgentDirectives(
      [
        "HEARTBEAT_OK",
        "REMINDER: at=2026-04-24T15:45:00.000Z | Calc session in 15 min | Open notes and queue problems",
        "REMINDER: at=2026-04-24T19:00:00.000Z | Bio quiz in 1h | Review flashcards",
      ].join("\n"),
    )
    expect(result.reminders).toEqual([
      {
        at: "2026-04-24T15:45:00.000Z",
        title: "Calc session in 15 min",
        body: "Open notes and queue problems",
      },
      {
        at: "2026-04-24T19:00:00.000Z",
        title: "Bio quiz in 1h",
        body: "Review flashcards",
      },
    ])
    expect(result.cleanedReply).toBe("HEARTBEAT_OK")
  })

  test("rejects REMINDER lines with unparsable timestamp (kept as plain text)", () => {
    const result = parseAgentDirectives(
      "REMINDER: at=not-a-date | title | body",
    )
    expect(result.reminders).toHaveLength(0)
    expect(result.cleanedReply).toContain("REMINDER: at=not-a-date")
  })

  test("WB_ADD and REMINDER coexist on different lines", () => {
    const result = parseAgentDirectives(
      [
        "Acute: study window starts in 10 min, nothing logged.",
        "REMINDER: at=2026-04-24T15:30:00.000Z | Start Calc | Open queue",
        "WB_ADD: ttl=6 | flagged calc session",
      ].join("\n"),
    )
    expect(result.reminders).toHaveLength(1)
    expect(result.notes).toHaveLength(1)
    expect(result.cleanedReply).toBe(
      "Acute: study window starts in 10 min, nothing logged.",
    )
  })
})

describe("checkHeartbeatAck", () => {
  test("HEARTBEAT_OK alone suppresses delivery", () => {
    expect(checkHeartbeatAck("HEARTBEAT_OK")).toEqual({
      suppress: true,
      remainder: "",
    })
  })

  test("HEARTBEAT_OK with short trailing comment still suppresses", () => {
    const ack = checkHeartbeatAck("HEARTBEAT_OK\nNothing notable today.")
    expect(ack.suppress).toBe(true)
    expect(ack.remainder).toBe("Nothing notable today.")
  })

  test("HEARTBEAT_OK followed by a long alert does NOT suppress", () => {
    const long = "x".repeat(400)
    expect(checkHeartbeatAck(`HEARTBEAT_OK\n${long}`).suppress).toBe(false)
  })

  test("missing HEARTBEAT_OK never suppresses", () => {
    expect(checkHeartbeatAck("Something urgent — pay attention").suppress).toBe(false)
  })
})
