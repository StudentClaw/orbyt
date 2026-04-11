import { beforeEach, describe, expect, test, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { IpcChannel } from "@student-claw/contracts"

const runtimeHooks = vi.hoisted(() => ({
  useRuntimeBootstrap: vi.fn(),
  useRuntimeServerConfig: vi.fn(),
}))

vi.mock("@/hooks/useAppRuntime", () => ({
  useRuntimeBootstrap: runtimeHooks.useRuntimeBootstrap,
  useRuntimeServerConfig: runtimeHooks.useRuntimeServerConfig,
}))

vi.mock("@/components/dev/DevOnboardingControls", () => ({
  DevOnboardingControls: () => <div data-testid="dev-onboarding-controls" />,
}))

import { SettingsPage } from "../pages/SettingsPage"

describe("SettingsPage", () => {
  const registryEntries = [
    {
      kind: "available",
      manifest: {
        id: "canvas-mcp",
        name: "Canvas Assistant",
        description: "Canvas integration",
        version: "0.1.0",
        transport: {
          type: "local_stdio",
          entry: "dist/index.js",
        },
        permissions: ["read"],
        auth: {
          type: "none",
        },
        tools: [{ name: "get_courses", description: "List courses" }],
        author: "student-claw",
        homepage: "https://github.com/StudentClaw/student-claw",
      },
      installSource: "bundled",
      status: "discovered",
      enabled: true,
    },
    {
      kind: "invalid",
      pluginId: "broken-mcp",
      displayName: "Broken MCP",
      installSource: "user",
      status: "error",
      enabled: false,
      lastError: "transport.entry is missing",
      manifestPath: "/tmp/broken/manifest.json",
    },
  ] as const

  beforeEach(() => {
    vi.clearAllMocks()
    runtimeHooks.useRuntimeServerConfig.mockReturnValue({
      appVersion: "0.1.0",
    })

    window.electronAPI = {
      getBootstrap: vi.fn().mockResolvedValue(null),
      codexAuthStart: vi.fn().mockResolvedValue({ status: "connected" as const }),
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn().mockReturnValue(() => {}),
    }
  })

  test("shows the disabled message when the plugin flag is off", () => {
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: false,
      },
    })

    render(<SettingsPage />)

    expect(screen.getByTestId("settings-plugin-disabled")).toBeDefined()
    expect(window.electronAPI?.invoke).not.toHaveBeenCalled()
  })

  test("renders discovered registry rows when the plugin flag is on", async () => {
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: true,
      },
    })

    window.electronAPI!.invoke = vi.fn().mockResolvedValue(registryEntries)

    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByTestId("settings-plugin-registry")).toBeDefined()
    })

    expect(window.electronAPI?.invoke).toHaveBeenCalledWith("plugin:list")
    expect(screen.getByText("Canvas Assistant")).toBeDefined()
    expect(screen.getByText("Broken MCP")).toBeDefined()
    expect(screen.getByText("transport.entry is missing")).toBeDefined()
    expect(screen.getByRole("button", { name: "Start" })).toBeDefined()
  })

  test("invokes plugin:start from the dev lifecycle controls", async () => {
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: true,
      },
    })

    window.electronAPI!.invoke = vi.fn(async (channel: string, params?: { pluginId: string }) => {
      if (channel === IpcChannel.PLUGIN_LIST) {
        return registryEntries
      }

      if (channel === IpcChannel.PLUGIN_START) {
        return {
          ok: true,
          pluginId: params?.pluginId ?? "canvas-mcp",
          status: "active",
        }
      }

      if (channel === IpcChannel.PLUGIN_GET_STATUS) {
        return {
          ...registryEntries[0],
          status: "active",
        }
      }

      return null
    })

    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start" })).toBeDefined()
    })

    fireEvent.click(screen.getByRole("button", { name: "Start" }))

    await waitFor(() => {
      expect(window.electronAPI?.invoke).toHaveBeenCalledWith(IpcChannel.PLUGIN_START, { pluginId: "canvas-mcp" })
    })
  })

  test("refreshes one row after a lifecycle event", async () => {
    let lifecycleListener: ((payload: { pluginId: string }) => void) | null = null

    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: true,
      },
    })

    window.electronAPI!.invoke = vi.fn(async (channel: string, params?: { pluginId: string }) => {
      if (channel === IpcChannel.PLUGIN_LIST) {
        return registryEntries
      }

      if (channel === IpcChannel.PLUGIN_GET_STATUS && params?.pluginId === "canvas-mcp") {
        return {
          ...registryEntries[0],
          status: "active",
        }
      }

      return null
    })
    window.electronAPI!.on = vi.fn((_channel, callback) => {
      lifecycleListener = callback as (payload: { pluginId: string }) => void
      return () => {
        lifecycleListener = null
      }
    })

    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByText("discovered")).toBeDefined()
    })

    lifecycleListener?.({ pluginId: "canvas-mcp" })

    await waitFor(() => {
      expect(screen.getByText("active")).toBeDefined()
    })
  })

  test("renders Retry for an available plugin in error state", async () => {
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: true,
      },
    })

    window.electronAPI!.invoke = vi.fn().mockResolvedValue([
      {
        ...registryEntries[0],
        status: "error",
        lastError: "boot failed",
      },
    ])

    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry" })).toBeDefined()
    })
  })
})
