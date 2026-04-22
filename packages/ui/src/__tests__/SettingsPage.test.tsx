import { beforeEach, describe, expect, test, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
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
  useSkills: vi.fn(),
}))

vi.mock("@/hooks/useAppRuntime", () => ({
  useOrchestrationActions: runtimeHooks.useOrchestrationActions,
  useRuntimeBootstrap: runtimeHooks.useRuntimeBootstrap,
  useRuntimeCanvasSyncProgress: runtimeHooks.useRuntimeCanvasSyncProgress,
  useRuntimeOrchestrationSnapshot: runtimeHooks.useRuntimeOrchestrationSnapshot,
  useRuntimeServerConfig: runtimeHooks.useRuntimeServerConfig,
  useSkills: runtimeHooks.useSkills,
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

const appRuntimeMocks = vi.hoisted(() => ({
  canvasSync: vi.fn(),
  waitForPrimaryWsRpcClient: vi.fn(),
}))

vi.mock("@/lib/codexAuth", () => ({
  connectCodexAccount: codexAuthMocks.connectCodexAccount,
}))

vi.mock("qrcode", () => ({
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr"),
}))

vi.mock("@/rpc/appRuntime", () => ({
  getPrimaryWsRpcClient: () => ({
    canvas: {
      sync: appRuntimeMocks.canvasSync,
    },
  }),
  waitForPrimaryWsRpcClient: appRuntimeMocks.waitForPrimaryWsRpcClient,
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
      kind: "available",
      manifest: {
        id: "apple-calendar-mcp",
        name: "Apple Calendar",
        description: "Local Apple Calendar integration",
        version: "1.0.0",
        transport: {
          type: "local_stdio",
          entry: "dist/index.js",
        },
        permissions: ["local_os.calendar.read", "local_os.calendar.write"],
        auth: {
          type: "none",
        },
        tools: [{ name: "getCalendars", description: "List calendars" }],
        author: "student-claw",
        homepage: "https://github.com/StudentClaw/student-claw",
      },
      installSource: "bundled",
      status: "discovered",
      enabled: false,
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
    appRuntimeMocks.canvasSync.mockResolvedValue(undefined)
    appRuntimeMocks.waitForPrimaryWsRpcClient.mockResolvedValue({
      onboarding: {
        getPreferences: vi.fn().mockResolvedValue({
          studyTimes: [],
          courseRanking: [],
          maxSessionMins: 90,
          offLimitDays: [],
          notificationEnabled: true,
          quietHoursStart: "22:00",
          quietHoursEnd: "08:00",
          calendarIntegration: "none",
          memoryGraphPath: "/Users/tester/Documents/Student Claw Memory Graph",
          memoryGraphPathMode: "default",
        }),
        setPreferences: vi.fn().mockResolvedValue({
          studyTimes: [],
          courseRanking: [],
          maxSessionMins: 90,
          offLimitDays: [],
          notificationEnabled: true,
          quietHoursStart: "22:00",
          quietHoursEnd: "08:00",
          calendarIntegration: "none",
          memoryGraphPath: "/Users/tester/Documents/Student Claw Memory Graph",
          memoryGraphPathMode: "default",
        }),
      },
    })

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
    runtimeHooks.useSkills.mockReturnValue([
      { id: "brainstorming", name: "brainstorming", description: "Explore ideas before implementation." },
      { id: "tdd", name: "tdd", description: "Test-driven development workflow." },
    ])
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
    expect(screen.getAllByText("Plugins").length).toBeGreaterThan(0)
    expect(screen.getByTestId("settings-plugin-disabled")).toBeDefined()
    expect(screen.queryByTestId("settings-codex-card")).toBeNull()

    await navigateTo("notifications")
    await waitFor(() => {
      expect(screen.getByTestId("settings-push-card")).toBeDefined()
    })
    expect(window.electronAPI?.invoke).toHaveBeenCalledWith(IpcChannel.PUSH_GET_SETTINGS)
  })

  test("renders plugin manager filters, rows, and skill counts when the plugin flag is on", async () => {
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
    expect(screen.getByTestId("settings-plugin-filter-plugins").textContent).toContain("3")
    expect(screen.getByTestId("settings-plugin-filter-mcps").textContent).toContain("3")
    expect(screen.getByTestId("settings-plugin-filter-skills").textContent).toContain("2")
    expect(screen.getAllByText("Canvas Assistant").length).toBeGreaterThan(0)
    expect(screen.getByText("Apple Calendar")).toBeDefined()
    expect(screen.getByText("Broken MCP")).toBeDefined()
    expect(screen.queryByTestId("settings-plugin-auth-card-canvas-mcp")).toBeNull()
  })

  test("supports searching plugins and switching to the skills tab", async () => {
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
      expect(screen.getByTestId("settings-plugin-row-canvas-mcp")).toBeDefined()
    })

    await user.type(screen.getByTestId("settings-plugin-search"), "calendar")
    expect(screen.queryByTestId("settings-plugin-row-canvas-mcp")).toBeNull()
    expect(screen.getByTestId("settings-plugin-row-apple-calendar-mcp")).toBeDefined()

    await user.click(screen.getByTestId("settings-plugin-filter-skills"))
    await user.clear(screen.getByTestId("settings-plugin-search"))
    expect(screen.getByTestId("settings-skill-row-brainstorming")).toBeDefined()
    expect(screen.getByTestId("settings-skill-row-tdd")).toBeDefined()
  })

  test("navigates into a plugin detail view with breadcrumb and tools", async () => {
    const user = userEvent.setup()

    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: true,
      },
    })

    render(<SettingsPage />)

    await navigateTo("connections")
    await user.click(await screen.findByTestId("settings-plugin-manage-canvas-mcp"))

    expect(screen.getAllByText("Canvas Assistant").length).toBeGreaterThan(0)
    expect(screen.getByText("Exposed tools")).toBeDefined()
    expect(screen.getByTestId("settings-plugin-tools-canvas-mcp")).toBeDefined()
    expect(screen.getByTestId("settings-plugin-tool-canvas-mcp-list_courses")).toBeDefined()
    expect(await screen.findByTestId("settings-plugin-auth-card-canvas-mcp")).toBeDefined()
    expect(screen.getByTestId("settings-plugin-auth-input-canvas-mcp-baseUrl")).toBeDefined()
    expect(screen.getByTestId("settings-plugin-auth-input-canvas-mcp-token")).toBeDefined()
  })

  test("disables Canvas sync while a sync is already in progress", async () => {
    const user = userEvent.setup()

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

    await user.click(screen.getByTestId("settings-plugin-manage-canvas-mcp"))
    const syncButton = await screen.findByRole("button", { name: "Syncing..." })
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
    window.electronAPI!.on = vi.fn((channel, callback) => {
      if (channel === IpcChannel.PLUGIN_LIFECYCLE) {
        lifecycleListener = callback as (payload: { pluginId: string }) => void
      }
      return () => {
        lifecycleListener = null
      }
    })

    render(<SettingsPage />)

    await navigateTo("connections")
    const row = await screen.findByTestId("settings-plugin-row-canvas-mcp")
    await waitFor(() => {
      expect(within(row).getByText("discovered")).toBeDefined()
    })

    await act(async () => {
      ;(lifecycleListener as ((payload: { pluginId: string }) => void) | null)?.({ pluginId: "canvas-mcp" })
    })

    await waitFor(() => {
      expect(within(row).getByText("active")).toBeDefined()
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
    const row = await screen.findByTestId("settings-plugin-row-canvas-mcp")
    await waitFor(() => {
      expect(within(row).getByText("error")).toBeDefined()
    })
  })

  test("renders Apple Calendar readiness details when provided by the desktop runtime", async () => {
    const user = userEvent.setup()

    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: true,
      },
    })

    window.electronAPI!.invoke = vi.fn(async (channel: string, params?: { pluginId: string }) => {
      if (channel === IpcChannel.PLUGIN_LIST) {
        return registryEntries.map((entry) => (
          entry.kind === "available" && entry.manifest.id === "apple-calendar-mcp"
            ? {
                ...entry,
                enabled: true,
                status: "error",
                readiness: "permission_required" as const,
                lastError: "Grant Calendar access in macOS Settings to finish enabling Apple Calendar.",
              }
            : entry
        ))
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
    await user.click(await screen.findByTestId("settings-plugin-manage-apple-calendar-mcp"))
    const readinessCard = await screen.findByTestId("settings-plugin-readiness-card-apple-calendar-mcp")
    expect(screen.getByTestId("settings-plugin-readiness-body-apple-calendar-mcp").textContent)
      .toContain("Grant Calendar access in macOS Settings to finish enabling Apple Calendar.")
    expect(within(readinessCard).getByRole("button", { name: "Grant Calendar access" })).toBeDefined()
    expect(screen.queryByTestId("settings-plugin-auth-card-apple-calendar-mcp")).toBeNull()
  })

  test("updates Apple Calendar readiness from the dedicated readiness event without refetching the row", async () => {
    const user = userEvent.setup()
    let readinessListener: ((payload: { pluginId: string; readiness: "ready"; lastError?: string }) => void) | null = null

    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
      featureFlags: {
        pluginSystem: true,
      },
    })

    window.electronAPI!.invoke = vi.fn(async (channel: string, params?: { pluginId: string }) => {
      if (channel === IpcChannel.PLUGIN_LIST) {
        return registryEntries.map((entry) => (
          entry.kind === "available" && entry.manifest.id === "apple-calendar-mcp"
            ? {
                ...entry,
                enabled: true,
                status: "error",
                readiness: "bridge_unavailable" as const,
                lastError: "The local bridge for Apple Calendar did not start. You can retry it.",
              }
            : entry
        ))
      }

      if (channel === IpcChannel.PLUGIN_GET_AUTH_STATUS && params?.pluginId === "canvas-mcp") {
        return {
          pluginId: "canvas-mcp",
          status: "not_configured" as const,
        }
      }

      return null
    }) as any
    window.electronAPI!.on = vi.fn((channel, callback) => {
      if (channel === IpcChannel.PLUGIN_READINESS) {
        readinessListener = callback as (payload: { pluginId: string; readiness: "ready"; lastError?: string }) => void
      }
      return () => {
        readinessListener = null
      }
    })

    render(<SettingsPage />)

    await navigateTo("connections")
    await user.click(await screen.findByTestId("settings-plugin-manage-apple-calendar-mcp"))
    await screen.findByTestId("settings-plugin-readiness-card-apple-calendar-mcp")
    expect(screen.getByTestId("settings-plugin-readiness-body-apple-calendar-mcp").textContent)
      .toContain("The local bridge for Apple Calendar did not start. You can retry it.")

    await act(async () => {
      ;(readinessListener as ((payload: { pluginId: string; readiness: "ready"; lastError?: string }) => void) | null)?.({
        pluginId: "apple-calendar-mcp",
        readiness: "ready",
        lastError: undefined,
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId("settings-plugin-readiness-body-apple-calendar-mcp").textContent)
        .toContain("Apple Calendar tools are available.")
    })
    expect(
      (window.electronAPI?.invoke as ReturnType<typeof vi.fn>).mock.calls.some(
        ([channel, params]) => channel === IpcChannel.PLUGIN_GET_STATUS && params?.pluginId === "apple-calendar-mcp",
      ),
    ).toBe(false)
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
    await user.click(await screen.findByTestId("settings-plugin-manage-canvas-mcp"))
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
      expect(within(authCard).getByText(/Status:\s*Configured/)).toBeDefined()
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
    await user.click(await screen.findByTestId("settings-plugin-manage-canvas-mcp"))
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
    await user.click(await screen.findByTestId("settings-plugin-manage-canvas-mcp"))
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
