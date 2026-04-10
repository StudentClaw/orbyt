import { describe, expect, test } from "vitest"
import type { OrchestrationSnapshot } from "@student-claw/contracts"
import { resolveCurrentThread } from "../hooks/chat-model"

const baseSnapshot: OrchestrationSnapshot = {
  threads: [
    {
      id: "thread-1" as never,
      title: "Old thread",
      status: "completed",
      createdAt: "2026-04-09T00:00:00.000Z",
      currentTurnId: null,
    },
    {
      id: "thread-2" as never,
      title: "Streaming thread",
      status: "streaming",
      createdAt: "2026-04-09T00:01:00.000Z",
      currentTurnId: "turn-2" as never,
    },
  ],
  turns: [
    {
      id: "turn-2" as never,
      threadId: "thread-2" as never,
      input: "hello",
      output: "world",
      status: "streaming",
      startedAt: "2026-04-09T00:01:00.000Z",
      completedAt: null,
    },
  ],
  providerStatus: "streaming",
  ready: true,
  lastSequence: 2,
}

describe("ChatPage thread selection", () => {
  test("falls back to the latest thread when no thread is selected", () => {
    expect(resolveCurrentThread(baseSnapshot, null)?.id).toBe("thread-2")
  })

  test("uses the explicitly selected thread when available", () => {
    expect(resolveCurrentThread(baseSnapshot, "thread-1")?.id).toBe("thread-1")
  })
})
