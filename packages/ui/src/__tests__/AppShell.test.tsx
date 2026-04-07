import { describe, test, expect } from "vitest"

describe("AppShell components", () => {
  test("page components are importable", async () => {
    const { DashboardPage } = await import("../pages/DashboardPage")
    const { ChatPage } = await import("../pages/ChatPage")
    const { OnboardingPage } = await import("../pages/OnboardingPage")
    const { SettingsPage } = await import("../pages/SettingsPage")
    const { ActivityPage } = await import("../pages/ActivityPage")
    expect(DashboardPage).toBeDefined()
    expect(ChatPage).toBeDefined()
    expect(OnboardingPage).toBeDefined()
    expect(SettingsPage).toBeDefined()
    expect(ActivityPage).toBeDefined()
  })

  test("ChatSheet is importable", async () => {
    const { ChatSheet } = await import("../components/shell/ChatSheet")
    expect(ChatSheet).toBeDefined()
  })
})
