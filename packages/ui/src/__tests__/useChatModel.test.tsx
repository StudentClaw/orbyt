import { beforeEach, describe, expect, test, vi } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import type { ServerConfig } from "@student-claw/contracts"

const serverStateMocks = vi.hoisted(() => ({
  config: null as ServerConfig | null,
}))

vi.mock("../rpc/serverState", () => ({
  useServerConfig: () => serverStateMocks.config,
}))

import { useChatModel } from "../hooks/useChatModel"

const baseConfig: ServerConfig = {
  appVersion: "0.1.0",
  platform: "test",
  protocolVersion: "rpc-v1",
  capabilities: {
    orchestration: true,
    providerRuntime: true,
    desktopBootstrap: true,
  },
  defaultChatModel: "gpt-5.4-mini",
  chatModels: [
    {
      id: "gpt-5.4",
      label: "GPT-5.4",
      description: "Best general-purpose model",
      group: "standard",
    },
    {
      id: "gpt-5.4-mini",
      label: "GPT-5.4 Mini",
      description: "Fast default model",
      group: "standard",
    },
    {
      id: "gpt-5.3-codex",
      label: "GPT-5.3 Codex",
      description: "Best coding-focused option",
      group: "standard",
    },
  ],
  featureFlags: {
    pluginSystem: false,
  },
}

describe("useChatModel", () => {
  beforeEach(() => {
    localStorage.clear()
    serverStateMocks.config = baseConfig
  })

  test("falls back to the runtime default model when stored model is invalid", async () => {
    localStorage.setItem("student-claw:selected-model", "unknown-model")

    const { result } = renderHook(() => useChatModel())

    await waitFor(() => {
      expect(result.current.selectedModel).toBe("gpt-5.4-mini")
    })
  })

  test("restores a valid stored model when it exists in the runtime catalog", async () => {
    localStorage.setItem("student-claw:selected-model", "gpt-5.3-codex")

    const { result } = renderHook(() => useChatModel())

    await waitFor(() => {
      expect(result.current.selectedModel).toBe("gpt-5.3-codex")
    })
  })

  test("persists a newly selected runtime-backed model", async () => {
    const { result } = renderHook(() => useChatModel())

    await act(async () => {
      result.current.setSelectedModel("gpt-5.3-codex")
    })

    expect(result.current.selectedModel).toBe("gpt-5.3-codex")
    expect(localStorage.getItem("student-claw:selected-model")).toBe("gpt-5.3-codex")
  })
})
