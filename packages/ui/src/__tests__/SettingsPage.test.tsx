import { beforeEach, describe, expect, test, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

const runtimeHooks = vi.hoisted(() => ({
  useRuntimeBootstrap: vi.fn(),
  useRuntimeServerConfig: vi.fn(),
}))

vi.mock("@/hooks/useAppRuntime", () => ({
  useRuntimeBootstrap: runtimeHooks.useRuntimeBootstrap,
  useRuntimeServerConfig: runtimeHooks.useRuntimeServerConfig,
}))

import { SettingsPage } from "../pages/SettingsPage"

describe("SettingsPage", () => {
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

    window.electronAPI!.invoke = vi.fn().mockResolvedValue([
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
    ])

    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByTestId("settings-plugin-registry")).toBeDefined()
    })

    expect(window.electronAPI?.invoke).toHaveBeenCalledWith("plugin:list")
    expect(screen.getByText("Canvas Assistant")).toBeDefined()
    expect(screen.getByText("Broken MCP")).toBeDefined()
    expect(screen.getByText("transport.entry is missing")).toBeDefined()
  })
})
