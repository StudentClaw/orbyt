import { describe, expect, test } from "vitest"
import type { OrchestrationSnapshot, ProviderRuntimeEvent } from "@student-claw/contracts"
import {
  formatProviderEventLabel,
  resolveCurrentThread,
  resolveProviderGuidance,
} from "../hooks/chat-model"

const baseSnapshot: OrchestrationSnapshot = {
  workspaces: [
    {
      id: "workspace-1" as never,
      kind: "filesystem",
      name: "Repo",
      rootPath: "/repo",
      availability: "ready",
      createdAt: "2026-04-09T00:00:00.000Z",
      updatedAt: "2026-04-09T00:00:00.000Z",
    },
  ],
  threads: [
    {
      id: "thread-1" as never,
      workspaceId: "workspace-1" as never,
      title: "Old thread",
      status: "completed",
      createdAt: "2026-04-09T00:00:00.000Z",
      currentTurnId: null,
    },
    {
      id: "thread-2" as never,
      workspaceId: "workspace-1" as never,
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
      reasoning: "",
      status: "streaming",
      startedAt: "2026-04-09T00:01:00.000Z",
      completedAt: null,
      skill: null,
    },
  ],
  providerStatus: "streaming",
  providerRuntime: {
    adapter: "codex",
    status: "streaming",
    authState: "authenticated",
    lastError: null,
    queuedTurnCount: 0,
    lastUpdatedAt: "2026-04-09T00:01:00.000Z",
  },
  ready: true,
  lastSequence: 2,
}

describe("ChatPage thread selection", () => {
  test("returns null when no thread is selected", () => {
    expect(resolveCurrentThread(baseSnapshot, null)).toBeNull()
  })

  test("uses the explicitly selected thread when available", () => {
    expect(resolveCurrentThread(baseSnapshot, "thread-1")?.id).toBe("thread-1")
  })

  test("surfaces recovery guidance when codex is degraded", () => {
    const guidance = resolveProviderGuidance({
      ...baseSnapshot,
      providerStatus: "degraded",
      providerRuntime: {
        ...baseSnapshot.providerRuntime,
        status: "degraded",
        lastError: {
          code: "codex_process_exited",
          message: "Codex app-server exited unexpectedly.",
        },
      },
    })

    expect(guidance).toEqual({
      title: "Codex runtime degraded",
      detail: "Codex app-server exited unexpectedly.",
      showRetry: true,
      showAuth: false,
    })
  })

  test("surfaces auth guidance when codex login is required", () => {
    const guidance = resolveProviderGuidance({
      ...baseSnapshot,
      providerStatus: "auth_required",
      providerRuntime: {
        ...baseSnapshot.providerRuntime,
        status: "auth_required",
        authState: "auth_required",
        lastError: {
          code: "codex_auth_required",
          message: "Codex CLI is not authenticated.",
        },
      },
    })

    expect(guidance).toEqual({
      title: "Codex login required",
      detail: "Codex CLI is not authenticated.",
      showRetry: false,
      showAuth: true,
    })
  })

  test("formats provider runtime events with meaningful detail", () => {
    const event: ProviderRuntimeEvent = {
      type: "provider.stateChanged",
      state: {
        adapter: "codex",
        status: "rate_limited",
        authState: "authenticated",
        lastError: {
          code: "codex_rate_limited",
          message: "Codex rate limit reached. Retry later.",
        },
        queuedTurnCount: 0,
        lastUpdatedAt: "2026-04-09T00:01:00.000Z",
      },
    }

    expect(formatProviderEventLabel(event)).toBe(
      "State changed to rate limited: codex_rate_limited",
    )
  })
})
