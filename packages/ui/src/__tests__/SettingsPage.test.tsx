import { beforeEach, describe, expect, test, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { IpcChannel } from "@student-claw/contracts"

async function navigateTo(section: "general" | "connections" | "notifications" | "schedule") {
  await userEvent.click(screen.getByTestId(`settings-nav-${section}`))
}

const runtimeHooks = vi.hoisted(() => ({
  useRuntimeBootstrap: vi.fn(),
  useRuntimeCanvasSyncProgress: vi.fn(),
  useRuntimeOrchestrationSnapshot: vi.fn(),
  useOrchestrationActions: vi.fn(),
  useRuntimeServerConfig: vi.fn(),
}))

vi.mock("@/hooks/useAppRuntime", () => ({
  useOrchestrationActions: runtimeHooks.useOrchestrationActions,
  useRuntimeBootstrap: runtimeHooks.useRuntimeBootstrap,
  useRuntimeCanvasSyncProgress: runtimeHooks.useRuntimeCanvasSyncProgress,
  useRuntimeOrchestrationSnapshot: runtimeHooks.useRuntimeOrchestrationSnapshot,
  useRuntimeServerConfig: runtimeHooks.useRuntimeServerConfig,
}))

vi.mock("@/components/dev/DevOnboardingControls", () => ({
  DevOnboardingControls: () => <div data-testid="dev-onboarding-controls" />,
}))

const codexAuthMocks = vi.hoisted(() => ({
  connectCodexAccount: vi.fn(),
}))

const notificationMocks = vi.hoisted(() => ({
  create: vi.fn(),
  requestPermission: vi.fn<() => Promise<NotificationPermission>>(),
}))

vi.mock("@/lib/codexAuth", () => ({
  connectCodexAccount: codexAuthMocks.connectCodexAccount,
}))

vi.mock("qrcode", () => ({
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr"),
}))

import { SettingsPage } from "../pages/SettingsPage"

describe("SettingsPage", () => {
  const defaultPushSettings = {
    enabled: true,
    workflowEventsEnabled: true,
    weeklyInsightsEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    weeklyInsightsDay: 1,
    weeklyInsightsTime: "08:00",
    relayBaseUrl: "https://push.example.com",
    linkedDevice: null,
    activePairing: null,
  } as const

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
    codexAuthMocks.connectCodexAccount.mockResolvedValue({ status: "connected" })
    notificationMocks.requestPermission.mockResolvedValue("granted")

    class MockNotification {
      static permission: NotificationPermission = "default"
      static requestPermission = notificationMocks.requestPermission

      constructor(title: string, options?: NotificationOptions) {
        notificationMocks.create(title, options)
      }
    }

    Object.defineProperty(window, "Notification", {
      configurable: true,
      writable: true,
      value: MockNotification,
    })

    runtimeHooks.useRuntimeServerConfig.mockReturnValue({
      appVersion: "0.1.0",
    })
    runtimeHooks.useRuntimeCanvasSyncProgress.mockReturnValue(null)
    runtimeHooks.useRuntimeOrchestrationSnapshot.mockReturnValue({
      providerRuntime: {
        adapter: "codex",
        status: "idle",
        authState: "authenticated",
        lastError: null,
        queuedTurnCount: 0,
        lastUpdatedAt: new Date(0).toISOString(),
      },
    })
    runtimeHooks.useOrchestrationActions.mockReturnValue({
      retryProviderInitialize: vi.fn().mockResolvedValue({ started: true }),
    })

    window.electronAPI = {
      getBootstrap: vi.fn().mockResolvedValue(null),
      codexAuthStart: vi.fn().mockResolvedValue({ status: "connected" as const }),
      invoke: vi.fn(async (channel: string, params?: { pluginId: string }) => {
        if (channel === IpcChannel.PUSH_GET_SETTINGS) {
          return defaultPushSettings
        }

        if (channel === IpcChannel.PUSH_GET_PAIRING_STATUS) {
          return {
            linkedDevice: null,
            activePairing: null,
          }
        }

        if (channel === IpcChannel.PUSH_SEND_TEST) {
          return { ok: true }
        }

        if (channel === IpcChannel.PUSH_UNLINK_DEVICE || channel === IpcChannel.PUSH_CANCEL_PAIRING) {
          return defaultPushSettings
        }

        if (channel === IpcChannel.PUSH_UPDATE_SETTINGS) {
          return {
            ...defaultPushSettings,
            ...(params ?? {}),
          }
        }

        if (channel === IpcChannel.PUSH_START_PAIRING) {
          return {
            sessionId: "session_1",
            qrUrl: "https://push.example.com/pair/session_1",
            expiresAt: "2026-04-15T13:00:00.000Z",
            state: "pending" as const,
          }
        }

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
      }) as any,
      send: vi.fn(),
      on: vi.fn().mockReturnValue(() => {}),
    }
  })

  test("shows the disabled message when the plugin flag is off", async () => {
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: false,
      },
    })

    render(<SettingsPage />)

    await navigateTo("connections")
    expect(screen.getByTestId("settings-codex-status").textContent).toBe("Connected")
    expect(screen.getByTestId("settings-plugin-disabled")).toBeDefined()

    await navigateTo("notifications")
    await waitFor(() => {
      expect(screen.getByTestId("settings-push-card")).toBeDefined()
    })
    expect(window.electronAPI?.invoke).toHaveBeenCalledWith(IpcChannel.PUSH_GET_SETTINGS)
  })

  test("shows Codex connection status from the runtime snapshot", async () => {
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: false,
      },
    })

    render(<SettingsPage />)

    await navigateTo("connections")
    expect(screen.getByTestId("settings-codex-card")).toBeDefined()
    expect(screen.getByTestId("settings-codex-status").textContent).toBe("Connected")
    expect(screen.getByTestId("settings-codex-auth-state").textContent).toContain("authenticated")
    expect(screen.getByTestId("settings-codex-runtime-state").textContent).toContain("idle")
  })

  test("connects Codex from settings when sign-in is required", async () => {
    const user = userEvent.setup()
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: false,
      },
    })
    runtimeHooks.useRuntimeOrchestrationSnapshot.mockReturnValue({
      providerRuntime: {
        adapter: "codex",
        status: "auth_required",
        authState: "auth_required",
        lastError: {
          code: "codex_auth_required",
          message: "Codex CLI is not authenticated.",
        },
        queuedTurnCount: 0,
        lastUpdatedAt: new Date(0).toISOString(),
      },
    })

    render(<SettingsPage />)

    await navigateTo("connections")
    await user.click(screen.getByTestId("settings-codex-connect"))

    expect(codexAuthMocks.connectCodexAccount).toHaveBeenCalledOnce()
  })

  test("renders discovered registry rows and manual auth fields when the plugin flag is on", async () => {
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: true,
      },
    })

    render(<SettingsPage />)

    await navigateTo("connections")
    await waitFor(() => {
      expect(screen.getByTestId("settings-plugin-registry")).toBeDefined()
    })

    expect(window.electronAPI?.invoke).toHaveBeenCalledWith(IpcChannel.PLUGIN_LIST)
    expect(window.electronAPI?.invoke).toHaveBeenCalledWith(IpcChannel.PLUGIN_GET_AUTH_STATUS, { pluginId: "canvas-mcp" })
    expect(screen.getAllByText("Canvas Assistant")).toHaveLength(2)
    expect(screen.getByText("Broken MCP")).toBeDefined()
    expect(screen.getByTestId("settings-plugin-auth-card-canvas-mcp")).toBeDefined()
    expect(screen.getByTestId("settings-plugin-auth-input-canvas-mcp-baseUrl")).toBeDefined()
    expect(screen.getByTestId("settings-plugin-auth-input-canvas-mcp-token")).toBeDefined()
  })

  test("disables Canvas sync while a sync is already in progress", async () => {
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: true,
      },
    })
    runtimeHooks.useRuntimeCanvasSyncProgress.mockReturnValue({
      courseId: "",
      progress: 25,
      status: "syncing",
    })

    render(<SettingsPage />)

    await navigateTo("connections")
    await waitFor(() => {
      expect(screen.getByTestId("settings-plugin-registry")).toBeDefined()
    })

    const syncButton = screen.getByRole("button", { name: "Syncing..." })
    expect(syncButton.hasAttribute("disabled")).toBe(true)
  })

  test("renders phone push settings and starts pairing", async () => {
    const user = userEvent.setup()
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: false,
      },
    })

    render(<SettingsPage />)

    await navigateTo("notifications")
    await waitFor(() => {
      expect(screen.getByTestId("settings-push-card")).toBeDefined()
    })

    expect(screen.getByTestId("settings-push-status").textContent).toBe("Not linked")
    expect(screen.getByTestId("settings-push-admin-tools")).toBeDefined()
    expect(screen.getByTestId("settings-push-main-flow")).toBeDefined()
    expect(within(screen.getByTestId("settings-push-main-flow")).getByText("Get alerts on your phone when work finishes.")).toBeDefined()
    expect(screen.getByTestId("settings-push-send-test").hasAttribute("disabled")).toBe(true)
    expect(screen.queryByTestId("settings-push-weekly-day")).toBeNull()
    expect((within(screen.getByTestId("settings-push-admin-tools")).getByTestId("settings-push-relay") as HTMLInputElement).value)
      .toBe("https://push.example.com")

    await user.click(screen.getByTestId("settings-push-pair"))

    expect(window.electronAPI?.invoke).toHaveBeenCalledWith(IpcChannel.PUSH_START_PAIRING)
    await waitFor(() => {
      expect(screen.getByTestId("settings-push-pairing")).toBeDefined()
      expect(screen.getByTestId("settings-push-qr")).toBeDefined()
    })
  })

  test("sends a desktop test notification from settings without requiring phone pairing", async () => {
    const user = userEvent.setup()
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: false,
      },
    })

    render(<SettingsPage />)

    await navigateTo("notifications")
    await waitFor(() => {
      expect(screen.getByTestId("settings-desktop-send-test")).toBeDefined()
    })

    expect(screen.getByTestId("settings-desktop-send-test").hasAttribute("disabled")).toBe(false)

    await user.click(screen.getByTestId("settings-desktop-send-test"))

    expect(notificationMocks.requestPermission).toHaveBeenCalledOnce()
    expect(notificationMocks.create).toHaveBeenCalledWith("Student Claw test notification", {
      body: "Desktop notifications are enabled for this app.",
    })
    expect(window.electronAPI?.invoke).not.toHaveBeenCalledWith(IpcChannel.NOTIFICATION_SHOW, expect.anything())
  })

  test("shows a friendly setup-required state before admin configuration is complete", async () => {
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: false,
      },
    })

    window.electronAPI!.invoke = vi.fn(async (channel: string) => {
      if (channel === IpcChannel.PUSH_GET_SETTINGS) {
        return {
          ...defaultPushSettings,
          relayBaseUrl: "",
        }
      }

      return null
    }) as any

    render(<SettingsPage />)

    await navigateTo("notifications")
    await waitFor(() => {
      expect(screen.getByTestId("settings-push-card")).toBeDefined()
    })

    expect(screen.getByTestId("settings-push-status").textContent).toBe("Setup required")
    expect(screen.getByTestId("settings-push-setup-state")).toBeDefined()
    expect(screen.getByText("Phone notifications are not configured on this desktop yet.")).toBeDefined()
    expect(screen.getByTestId("settings-push-pair").hasAttribute("disabled")).toBe(true)
    expect(screen.queryByTestId("settings-push-error")).toBeNull()
  })

  test("cancels an active phone pairing session", async () => {
    const user = userEvent.setup()
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: false,
      },
    })

    render(<SettingsPage />)

    await navigateTo("notifications")
    await waitFor(() => {
      expect(screen.getByTestId("settings-push-pair")).toBeDefined()
    })

    await user.click(screen.getByTestId("settings-push-pair"))

    await waitFor(() => {
      expect(screen.getByTestId("settings-push-pairing")).toBeDefined()
    })

    await user.click(screen.getByTestId("settings-push-cancel"))

    expect(window.electronAPI?.invoke).toHaveBeenCalledWith(IpcChannel.PUSH_CANCEL_PAIRING)
    await waitFor(() => {
      expect(screen.queryByTestId("settings-push-pairing")).toBeNull()
    })
  })

  test("keeps preferences hidden until a phone is linked", async () => {
    const user = userEvent.setup()
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: false,
      },
    })

    window.electronAPI!.invoke = vi.fn(async (channel: string) => {
      if (channel === IpcChannel.PUSH_GET_SETTINGS) {
        return {
          ...defaultPushSettings,
          linkedDevice: {
            endpoint: "https://push.example.com/subscription",
            platform: "ios" as const,
            linkedAt: "2026-04-16T10:00:00.000Z",
          },
        }
      }

      if (channel === IpcChannel.PUSH_SEND_TEST) {
        return { ok: true }
      }

      if (channel === IpcChannel.PUSH_UNLINK_DEVICE) {
        return defaultPushSettings
      }

      return null
    }) as any

    render(<SettingsPage />)

    await navigateTo("notifications")
    await waitFor(() => {
      expect(screen.getByTestId("settings-push-status").textContent).toContain("Linked")
    })

    expect(screen.getByTestId("settings-push-linked-state")).toBeDefined()
    expect(screen.getByTestId("settings-push-send-test").hasAttribute("disabled")).toBe(false)
    expect(screen.queryByTestId("settings-push-weekly-day")).toBeNull()

    await user.click(screen.getByTestId("settings-push-preferences-toggle"))

    expect(screen.getByTestId("settings-push-weekly-day")).toBeDefined()
    expect(screen.getByTestId("settings-push-quiet-start")).toBeDefined()
  })

  test("invokes plugin:setEnabled when the toggle switch is clicked", async () => {
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: true,
      },
    })

    window.electronAPI!.invoke = vi.fn(async (channel: string, params?: { pluginId: string; enabled?: boolean }) => {
      if (channel === IpcChannel.PLUGIN_LIST) {
        return registryEntries
      }

      if (channel === IpcChannel.PLUGIN_GET_AUTH_STATUS && params?.pluginId === "canvas-mcp") {
        return {
          pluginId: "canvas-mcp",
          status: "not_configured" as const,
        }
      }

      if (channel === IpcChannel.PLUGIN_SET_ENABLED) {
        return {
          ok: true,
          pluginId: params?.pluginId ?? "canvas-mcp",
          enabled: params?.enabled ?? true,
        }
      }

      if (channel === IpcChannel.PLUGIN_GET_STATUS) {
        return {
          ...registryEntries[0],
          status: "active",
        }
      }

      return null
    }) as any

    render(<SettingsPage />)

    await navigateTo("connections")
    const toggle = await screen.findByRole("switch", { name: /Enable Canvas Assistant|Disable Canvas Assistant/ })
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(window.electronAPI?.invoke).toHaveBeenCalledWith(
        IpcChannel.PLUGIN_SET_ENABLED,
        expect.objectContaining({ pluginId: "canvas-mcp" }),
      )
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
    }) as any
    window.electronAPI!.on = vi.fn((_channel, callback) => {
      lifecycleListener = callback as (payload: { pluginId: string }) => void
      return () => {
        lifecycleListener = null
      }
    })

    render(<SettingsPage />)

    await navigateTo("connections")
    await waitFor(() => {
      expect(screen.getByText("discovered")).toBeDefined()
    })

    ;(lifecycleListener as ((payload: { pluginId: string }) => void) | null)?.({ pluginId: "canvas-mcp" })

    await waitFor(() => {
      expect(screen.getByText("active")).toBeDefined()
    })
  })

  test("renders an error-state row for an available plugin in error state", async () => {
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
    }) as any

    render(<SettingsPage />)

    await navigateTo("connections")
    await waitFor(() => {
      expect(screen.getByText("error")).toBeDefined()
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
    }) as any

    render(<SettingsPage />)

    await navigateTo("connections")
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

    await navigateTo("connections")
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
    }) as any

    render(<SettingsPage />)

    await navigateTo("connections")
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
