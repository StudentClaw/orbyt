import { beforeEach, describe, expect, test, vi } from "vitest"
import type {
  ServerConfig,
  ServerConfigStreamEvent,
  ServerLifecycleEvent,
} from "@orbyt/contracts"
import {
  getServerConfig,
  onServerConfig,
  onServerWelcome,
  resetServerStateForTests,
  startServerStateSync,
} from "./serverState"

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
  ],
  featureFlags: {
    pluginSystem: false,
  },
}

describe("serverState", () => {
  const lifecycleListeners = new Set<(event: ServerLifecycleEvent) => void>()
  const configListeners = new Set<(event: ServerConfigStreamEvent) => void>()

  const serverApi = {
    getConfig: vi.fn(async () => baseConfig),
    subscribeLifecycle: vi.fn((listener: (event: ServerLifecycleEvent) => void) => {
      lifecycleListeners.add(listener)
      return () => lifecycleListeners.delete(listener)
    }),
    subscribeConfig: vi.fn((listener: (event: ServerConfigStreamEvent) => void) => {
      configListeners.add(listener)
      return () => configListeners.delete(listener)
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    lifecycleListeners.clear()
    configListeners.clear()
    resetServerStateForTests()
  })

  test("bootstraps config and replays it to late subscribers", async () => {
    const stop = startServerStateSync({ server: serverApi } as never)

    await Promise.resolve()

    expect(serverApi.getConfig).toHaveBeenCalledOnce()
    expect(getServerConfig()).toEqual(baseConfig)

    const earlyListener = vi.fn()
    const unsubscribe = onServerConfig(earlyListener)
    expect(earlyListener).toHaveBeenCalledWith(baseConfig)

    const lateListener = vi.fn()
    const unsubscribeLate = onServerConfig(lateListener)
    expect(lateListener).toHaveBeenCalledWith(baseConfig)

    unsubscribeLate()
    unsubscribe()
    stop()
  })

  test("replays welcome events to late subscribers", () => {
    const stop = startServerStateSync({ server: serverApi } as never)

    const welcome = {
      type: "welcome" as const,
      payload: {
        bootstrap: {
          wsUrl: "ws://127.0.0.1:8787",
          wsAuthToken: "a".repeat(64),
          appVersion: "0.1.0",
          platform: "test",
          featureFlags: {
            pluginSystem: false,
          },
        },
        connectedAt: "2026-04-09T12:00:00.000Z",
      },
    }

    for (const listener of lifecycleListeners) {
      listener(welcome)
    }

    const earlyListener = vi.fn()
    const unsubscribe = onServerWelcome(earlyListener)
    expect(earlyListener).toHaveBeenCalledWith(welcome.payload)

    const lateListener = vi.fn()
    const unsubscribeLate = onServerWelcome(lateListener)
    expect(lateListener).toHaveBeenCalledWith(welcome.payload)

    unsubscribeLate()
    unsubscribe()
    stop()
  })
})
