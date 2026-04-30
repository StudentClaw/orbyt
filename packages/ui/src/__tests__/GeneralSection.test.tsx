import { beforeEach, describe, expect, test, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { IpcChannel } from "@orbyt/contracts"

const runtimeHooks = vi.hoisted(() => ({
  useRuntimeBootstrap: vi.fn(),
  useRuntimeServerConfig: vi.fn(),
}))

const appRuntimeMocks = vi.hoisted(() => ({
  waitForPrimaryWsRpcClient: vi.fn(),
}))

const themeMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
}))

vi.mock("@/hooks/useAppRuntime", () => ({
  useRuntimeBootstrap: runtimeHooks.useRuntimeBootstrap,
  useRuntimeServerConfig: runtimeHooks.useRuntimeServerConfig,
}))

vi.mock("@/rpc/appRuntime", () => ({
  waitForPrimaryWsRpcClient: appRuntimeMocks.waitForPrimaryWsRpcClient,
}))

vi.mock("@/hooks/useTheme", () => ({
  useTheme: themeMocks.useTheme,
}))

import { GeneralSection } from "../components/settings/GeneralSection"

describe("GeneralSection", () => {
  const mockGetPreferences = vi.fn()
  const mockSetPreferences = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    themeMocks.useTheme.mockReturnValue({
      theme: "auto",
      setTheme: vi.fn(),
    })
    runtimeHooks.useRuntimeBootstrap.mockReturnValue({
      platform: "darwin",
    })
    runtimeHooks.useRuntimeServerConfig.mockReturnValue({
      appVersion: "0.1.0",
    })
    mockGetPreferences.mockResolvedValue({
      studyTimes: [],
      courseRanking: [],
      maxSessionMins: 90,
      offLimitDays: [],
      notificationEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      calendarIntegration: "none",
      memoryGraphPath: "/Users/tester/Documents/Orbyt Memory Graph",
      memoryGraphPathMode: "default",
    })
    mockSetPreferences.mockImplementation(async ({ memoryGraphPath }) => ({
      studyTimes: [],
      courseRanking: [],
      maxSessionMins: 90,
      offLimitDays: [],
      notificationEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      calendarIntegration: "none",
      memoryGraphPath: memoryGraphPath ?? "/Users/tester/Documents/Orbyt Memory Graph",
      memoryGraphPathMode: memoryGraphPath ? "custom" : "default",
    }))
    appRuntimeMocks.waitForPrimaryWsRpcClient.mockResolvedValue({
      onboarding: {
        getPreferences: mockGetPreferences,
        setPreferences: mockSetPreferences,
      },
    })
    const updateState = {
      enabled: true,
      mode: "automatic" as const,
      status: "idle" as const,
      currentVersion: "0.1.0",
      availableVersion: null,
      downloadedVersion: null,
      checkedAt: null,
      downloadPercent: null,
      message: null,
      errorContext: null,
    }
    window.electronAPI = {
      getBootstrap: vi.fn().mockResolvedValue(null),
      codexAuthStart: vi.fn().mockResolvedValue({ status: "connected" as const }),
      invoke: vi.fn(async (channel: IpcChannel, params?: unknown) => {
        if (channel === IpcChannel.APP_UPDATE_GET_STATE) {
          return updateState
        }
        if (channel === IpcChannel.APP_UPDATE_SET_MODE) {
          return { state: { ...updateState, mode: (params as { mode: "automatic" | "prompt" }).mode } }
        }
        if (channel === IpcChannel.APP_UPDATE_CHECK) {
          return { checked: true, state: { ...updateState, message: "Orbyt is up to date." } }
        }
        return "/tmp/custom-graph"
      }) as NonNullable<Window["electronAPI"]>["invoke"],
      send: vi.fn(),
      on: vi.fn().mockReturnValue(() => {}),
    }
  })

  test("loads and displays the current memory graph path", async () => {
    render(<GeneralSection />)

    await waitFor(() => {
      expect((screen.getByTestId("settings-memory-graph-path") as HTMLInputElement).value).toBe(
        "/Users/tester/Documents/Orbyt Memory Graph",
      )
    })
    expect(screen.getByTestId("settings-memory-graph-mode").textContent).toContain("default Documents location")
  })

  test("saves a custom memory graph path", async () => {
    render(<GeneralSection />)
    await waitFor(() => screen.getByTestId("settings-memory-graph-path"))

    await userEvent.click(screen.getByTestId("settings-memory-graph-browse"))
    expect(window.electronAPI?.invoke).toHaveBeenCalledWith(IpcChannel.FILE_OPEN_DIALOG, { directory: true })
    await userEvent.click(screen.getByTestId("settings-memory-graph-save"))

    await waitFor(() => {
      expect(mockSetPreferences).toHaveBeenCalledWith({ memoryGraphPath: "/tmp/custom-graph" })
    })
    expect(screen.getByTestId("settings-memory-graph-mode").textContent).toContain("custom graph location")
  })

  test("resets back to the default memory graph path", async () => {
    mockGetPreferences.mockResolvedValue({
      studyTimes: [],
      courseRanking: [],
      maxSessionMins: 90,
      offLimitDays: [],
      notificationEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      calendarIntegration: "none",
      memoryGraphPath: "/tmp/custom-graph",
      memoryGraphPathMode: "custom",
    })

    render(<GeneralSection />)
    await waitFor(() => screen.getByTestId("settings-memory-graph-reset"))

    await userEvent.click(screen.getByTestId("settings-memory-graph-reset"))

    await waitFor(() => {
      expect(mockSetPreferences).toHaveBeenCalledWith({ memoryGraphPath: null })
    })
    expect(screen.getByTestId("settings-memory-graph-mode").textContent).toContain("default Documents location")
  })

  test("shows desktop update controls and changes install mode", async () => {
    render(<GeneralSection />)

    await waitFor(() => {
      expect(screen.getByTestId("settings-desktop-updates-card").textContent).toContain("Orbyt 0.1.0")
    })

    await userEvent.click(screen.getByTestId("settings-updates-mode-prompt"))

    await waitFor(() => {
      expect(window.electronAPI?.invoke).toHaveBeenCalledWith(IpcChannel.APP_UPDATE_SET_MODE, { mode: "prompt" })
    })
  })
})
