import { describe, test, expect } from "bun:test"
import {
  buildHeartbeatPrompt,
  parseAgentDirectives,
  checkHeartbeatAck,
} from "../prompts.js"
import { parseHeartbeatProtocol } from "../heartbeat-protocol.js"
import type { HeartbeatCandidate } from "../heartbeat-candidates.js"

const NO_CANDIDATES: ReadonlyArray<HeartbeatCandidate> = []

describe("buildHeartbeatPrompt", () => {
  test("includes scope, working buffer, sessions, and strict digest protocol", () => {
    const prompt = buildHeartbeatPrompt({
      heartbeatScope: "watch for missed deadlines",
      workingBufferNotes: [],
      nowIso: "2026-04-24T12:00:00.000Z",
      candidates: NO_CANDIDATES,
      todaysSessions: [],
    })
    expect(prompt).toContain("DIGEST:")
    expect(prompt).toContain("SKIP")
    expect(prompt).toContain("watch for missed deadlines")
    expect(prompt).toContain("(no active notes)")
    expect(prompt).toContain("(no sessions today)")
    expect(prompt).toContain("nothing on fire this tick")
    expect(prompt).toContain("2026-04-24T12:00:00.000Z")
    // Voice rules surface in the prompt body.
    expect(prompt).toContain("lowercase by default")
    expect(prompt).toContain("ALL CAPS")
    expect(prompt).toContain("no emoji")
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
      candidates: NO_CANDIDATES,
      todaysSessions: [],
    })
    expect(prompt).toContain("watch CS")
    expect(prompt).toContain("expires 2026-04-25T10:00:00.000Z")
  })

  test("renders an imminent candidate and simplifies its course code", () => {
    const candidates: HeartbeatCandidate[] = [
      {
        kind: "instant_imminent",
        state: "due_soon",
        itemId: "asg-1",
        course: "2025FA_CS38_INTRO_PROGRAMMING",
        title: "Lab 4",
        assignmentType: "work",
        dueAt: "2026-04-24T13:00:00.000Z",
        dueAtMs: Date.parse("2026-04-24T13:00:00.000Z"),
        minutesUntil: 60,
        htmlUrl: "https://canvas.test/lab4",
      },
    ]
    const prompt = buildHeartbeatPrompt({
      heartbeatScope: "",
      workingBufferNotes: [],
      nowIso: "2026-04-24T12:00:00.000Z",
      candidates,
      todaysSessions: [],
    })
    expect(prompt).toContain("[IMMINENT] CS38 Lab 4")
    expect(prompt).not.toContain("2025FA_CS38_INTRO_PROGRAMMING")
    expect(prompt).toContain("type=work")
  })

  test("renders schedule_later candidates with kind and timing", () => {
    const candidates: HeartbeatCandidate[] = [
      {
        kind: "schedule_later",
        state: "starting_soon",
        itemId: "asg-2",
        course: "2025FA_CHEM230_GENERAL_CHEMISTRY",
        title: "Quiz 4",
        assignmentType: "assessment",
        dueAt: "2026-04-24T16:00:00.000Z",
        dueAtMs: Date.parse("2026-04-24T16:00:00.000Z"),
        minutesUntil: 240,
        htmlUrl: null,
        scheduleAtIso: "2026-04-24T15:45:00.000Z",
      },
    ]
    const prompt = buildHeartbeatPrompt({
      heartbeatScope: "",
      workingBufferNotes: [],
      nowIso: "2026-04-24T12:00:00.000Z",
      candidates,
      todaysSessions: [],
    })
    expect(prompt).toContain("[UPCOMING] CHEM230 Quiz 4")
    expect(prompt).toContain("type=assessment")
    expect(prompt).toContain("in 240 min")
  })
})

describe("heartbeat parser integration with prompt-style replies", () => {
  test("DIGEST line yields a digest decision", () => {
    const out = parseHeartbeatProtocol(
      "DIGEST: BRO chem exam in 2 hrs. also that phys prelab is due tonight, plus cs38 lab 4 still floating.",
    )
    expect(out.decision).toBe("digest")
    if (out.decision === "digest") {
      expect(out.body).toContain("BRO")
      expect(out.body).toContain("phys prelab")
    }
  })

  test("SKIP yields a skip decision", () => {
    expect(parseHeartbeatProtocol("SKIP").decision).toBe("skip")
  })

  test("any other content is treated as skip", () => {
    expect(parseHeartbeatProtocol("just narration").decision).toBe("skip")
    expect(parseHeartbeatProtocol("").decision).toBe("skip")
  })

  test("emoji and ascii separator dashes are sanitized out of the digest body", () => {
    const out = parseHeartbeatProtocol(
      "DIGEST: yo \u{1F525} chem exam in 2 hrs - also a phys prelab tonight",
    )
    expect(out.decision).toBe("digest")
    if (out.decision === "digest") {
      expect(out.body).not.toContain("\u{1F525}")
      expect(out.body).not.toContain(" - ")
    }
  })

  test("unicode dashes are stripped from the digest body", () => {
    const out = parseHeartbeatProtocol(
      "DIGEST: yo — chem exam soon – prelab tonight",
    )
    expect(out.decision).toBe("digest")
    if (out.decision === "digest") {
      expect(out.body).not.toMatch(/[‐-―−]/)
    }
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

describe("checkHeartbeatAck (legacy)", () => {
  test("HEARTBEAT_OK alone suppresses delivery", () => {
    expect(checkHeartbeatAck("HEARTBEAT_OK")).toEqual({
      suppress: true,
      remainder: "",
    })
  })
})
