import { beforeEach, describe, expect, test, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
          type: "manual_token",
          instructions: "Paste your Canvas base URL and token.",
          fields: [
            {
              key: "baseUrl",
              label: "Canvas base URL",
              type: "base_url",
              required: true,
              placeholder: "https://myschool.instructure.com",
            },
            {
              key: "token",
              label: "Canvas access token",
              type: "secret",
              required: true,
              placeholder: "Paste your Canvas access token",
            },
          ],
        },
        tools: [{ name: "list_courses", description: "List courses" }],
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
      invoke: vi.fn(async (channel: string, params?: { pluginId: string }) => {
        if (channel === IpcChannel.PLUGIN_LIST) {
          return registryEntries
        }

        if (channel === IpcChannel.PLUGIN_GET_AUTH_STATUS && params?.pluginId === "canvas-mcp") {
          return {
            pluginId: "canvas-mcp",
            status: "not_configured" as const,
          }
        }

        if (channel === IpcChannel.PLUGIN_GET_STATUS && params?.pluginId === "canvas-mcp") {
          return registryEntries[0]
        }

        return null
      }),
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

  test("renders discovered registry rows and manual auth fields when the plugin flag is on", async () => {
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: true,
      },
    })

    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByTestId("settings-plugin-registry")).toBeDefined()
    })

    expect(window.electronAPI?.invoke).toHaveBeenCalledWith(IpcChannel.PLUGIN_LIST)
    expect(window.electronAPI?.invoke).toHaveBeenCalledWith(IpcChannel.PLUGIN_GET_AUTH_STATUS, { pluginId: "canvas-mcp" })
    expect(screen.getAllByText("Canvas Assistant")).toHaveLength(2)
    expect(screen.getByText("Broken MCP")).toBeDefined()
    expect(screen.getByText("transport.entry is missing")).toBeDefined()
    expect(screen.getByRole("button", { name: "Start" })).toBeDefined()
    expect(screen.getByTestId("settings-plugin-auth-card-canvas-mcp")).toBeDefined()
    expect(screen.getByTestId("settings-plugin-auth-input-canvas-mcp-baseUrl")).toBeDefined()
    expect(screen.getByTestId("settings-plugin-auth-input-canvas-mcp-token")).toBeDefined()
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

      if (channel === IpcChannel.PLUGIN_GET_AUTH_STATUS && params?.pluginId === "canvas-mcp") {
        return {
          pluginId: "canvas-mcp",
          status: "not_configured" as const,
        }
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

      if (channel === IpcChannel.PLUGIN_GET_AUTH_STATUS && params?.pluginId === "canvas-mcp") {
        return {
          pluginId: "canvas-mcp",
          status: "not_configured" as const,
        }
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

    window.electronAPI!.invoke = vi.fn(async (channel: string, params?: { pluginId: string }) => {
      if (channel === IpcChannel.PLUGIN_LIST) {
        return [
          {
            ...registryEntries[0],
            status: "error",
            lastError: "boot failed",
          },
        ]
      }

      if (channel === IpcChannel.PLUGIN_GET_AUTH_STATUS && params?.pluginId === "canvas-mcp") {
        return {
          pluginId: "canvas-mcp",
          status: "not_configured" as const,
        }
      }

      return null
    })

    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry" })).toBeDefined()
    })
  })

  test("saves credentials through the desktop bridge", async () => {
    const user = userEvent.setup()

    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: true,
      },
    })

    window.electronAPI!.invoke = vi.fn(async (channel: string, params?: { pluginId: string; values?: Record<string, string> }) => {
      if (channel === IpcChannel.PLUGIN_LIST) {
        return registryEntries
      }

      if (channel === IpcChannel.PLUGIN_GET_AUTH_STATUS && params?.pluginId === "canvas-mcp") {
        return {
          pluginId: "canvas-mcp",
          status: "not_configured" as const,
        }
      }

      if (channel === IpcChannel.PLUGIN_SAVE_AUTH) {
        expect(params).toEqual({
          pluginId: "canvas-mcp",
          values: {
            baseUrl: "https://myschool.instructure.com",
            token: "12345678901234567890",
          },
        })

        return {
          ok: true,
          pluginId: "canvas-mcp",
          status: "configured" as const,
        }
      }

      return null
    })

    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByTestId("settings-plugin-auth-card-canvas-mcp")).toBeDefined()
    })

    await user.type(screen.getByTestId("settings-plugin-auth-input-canvas-mcp-baseUrl"), "https://myschool.instructure.com")
    await user.type(screen.getByTestId("settings-plugin-auth-input-canvas-mcp-token"), "12345678901234567890")
    await user.click(screen.getByTestId("settings-plugin-auth-save-canvas-mcp"))

    await waitFor(() => {
      expect(window.electronAPI?.invoke).toHaveBeenCalledWith(IpcChannel.PLUGIN_SAVE_AUTH, {
        pluginId: "canvas-mcp",
        values: {
          baseUrl: "https://myschool.instructure.com",
          token: "12345678901234567890",
        },
      })
    })

    await waitFor(() => {
      const authCard = screen.getByTestId("settings-plugin-auth-card-canvas-mcp")
      expect(within(authCard).getByText("Configured")).toBeDefined()
    })
  })

  test("shows field validation before save when credentials are malformed", async () => {
    const user = userEvent.setup()

    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: true,
      },
    })

    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByTestId("settings-plugin-auth-card-canvas-mcp")).toBeDefined()
    })

    await user.type(screen.getByTestId("settings-plugin-auth-input-canvas-mcp-baseUrl"), "http://example.com")
    await user.type(screen.getByTestId("settings-plugin-auth-input-canvas-mcp-token"), "short")
    await user.click(screen.getByTestId("settings-plugin-auth-save-canvas-mcp"))

    expect(screen.getByTestId("settings-plugin-auth-field-error-canvas-mcp-baseUrl").textContent)
      .toContain("Enter a valid HTTPS Canvas URL.")
    expect(screen.getByTestId("settings-plugin-auth-field-error-canvas-mcp-token").textContent)
      .toContain("Enter at least 20 characters.")
    const invokeMock = window.electronAPI?.invoke as ReturnType<typeof vi.fn>
    expect(invokeMock.mock.calls.some(([channel]) => channel === IpcChannel.PLUGIN_SAVE_AUTH)).toBe(false)
  })

  test("accepts custom HTTPS Canvas domains", async () => {
    const user = userEvent.setup()

    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: true,
      },
    })

    window.electronAPI!.invoke = vi.fn(async (channel: string, params?: { pluginId: string; values?: Record<string, string> }) => {
      if (channel === IpcChannel.PLUGIN_LIST) {
        return registryEntries
      }

      if (channel === IpcChannel.PLUGIN_GET_AUTH_STATUS && params?.pluginId === "canvas-mcp") {
        return {
          pluginId: "canvas-mcp",
          status: "not_configured" as const,
        }
      }

      if (channel === IpcChannel.PLUGIN_SAVE_AUTH) {
        expect(params?.values?.baseUrl).toBe("https://canvas.socccd.edu/")
        return {
          ok: true,
          pluginId: "canvas-mcp",
          status: "configured" as const,
        }
      }

      return null
    })

    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByTestId("settings-plugin-auth-card-canvas-mcp")).toBeDefined()
    })

    await user.type(screen.getByTestId("settings-plugin-auth-input-canvas-mcp-baseUrl"), "https://canvas.socccd.edu/")
    await user.type(screen.getByTestId("settings-plugin-auth-input-canvas-mcp-token"), "12345678901234567890")
    await user.click(screen.getByTestId("settings-plugin-auth-save-canvas-mcp"))

    await waitFor(() => {
      expect(window.electronAPI?.invoke).toHaveBeenCalledWith(IpcChannel.PLUGIN_SAVE_AUTH, {
        pluginId: "canvas-mcp",
        values: {
          baseUrl: "https://canvas.socccd.edu/",
          token: "12345678901234567890",
        },
      })
    })
  })
})
