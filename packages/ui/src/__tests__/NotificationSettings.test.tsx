import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import { NotificationSettings } from "../components/notifications/NotificationSettings"

describe("NotificationSettings", () => {
  test("renders notification settings", () => {
    render(<NotificationSettings />)
    expect(screen.getByTestId("notification-settings")).toBeDefined()
  })

  test("renders master toggle", () => {
    render(<NotificationSettings />)
    expect(screen.getByTestId("notif-master-toggle")).toBeDefined()
  })

  test("renders quiet hours inputs", () => {
    render(<NotificationSettings />)
    expect(screen.getByTestId("notif-quiet-start")).toBeDefined()
    expect(screen.getByTestId("notif-quiet-end")).toBeDefined()
  })

  test("renders category toggles", () => {
    render(<NotificationSettings />)
    expect(screen.getByTestId("notif-toggle-canvas")).toBeDefined()
    expect(screen.getByTestId("notif-toggle-planner")).toBeDefined()
    expect(screen.getByTestId("notif-toggle-workflow")).toBeDefined()
    expect(screen.getByTestId("notif-toggle-insight")).toBeDefined()
  })
})
