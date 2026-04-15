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
      id: "gpt-5.4-mini",
      label: "GPT-5.4 Mini",
      description: "Fast default model",
      group: "standard",
    },
    {
      id: "o3",
      label: "o3",
      description: "Most capable reasoning model",
      group: "reasoning",
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
    localStorage.setItem("student-claw:selected-model", "o3")

    const { result } = renderHook(() => useChatModel())

    await waitFor(() => {
      expect(result.current.selectedModel).toBe("o3")
    })
  })

  test("persists a newly selected runtime-backed model", async () => {
    const { result } = renderHook(() => useChatModel())

    await act(async () => {
      result.current.setSelectedModel("o3")
    })

    expect(result.current.selectedModel).toBe("o3")
    expect(localStorage.getItem("student-claw:selected-model")).toBe("o3")
  })
})
