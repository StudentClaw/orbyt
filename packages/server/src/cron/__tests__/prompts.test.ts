import { describe, test, expect } from "bun:test"
import {
  buildHeartbeatPrompt,
  parseAgentDirectives,
  checkHeartbeatAck,
} from "../prompts.js"

describe("buildHeartbeatPrompt", () => {
  test("includes scope, working buffer, and HEARTBEAT_OK protocol", () => {
    const prompt = buildHeartbeatPrompt({
      heartbeatScope: "watch for missed deadlines",
      workingBufferNotes: [],
      nowIso: "2026-04-24T12:00:00.000Z",
    })
    expect(prompt).toContain("HEARTBEAT_OK")
    expect(prompt).toContain("WB_ADD")
    expect(prompt).toContain("watch for missed deadlines")
    expect(prompt).toContain("(no active notes)")
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
    })
    expect(prompt).toContain("watch CS")
    expect(prompt).toContain("expires 2026-04-25T10:00:00.000Z")
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
