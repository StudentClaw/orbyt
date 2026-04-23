import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const codexAuthMocks = vi.hoisted(() => ({
  connectCodexAccount: vi.fn(),
}))

vi.mock("@/lib/codexAuth", () => ({
  connectCodexAccount: codexAuthMocks.connectCodexAccount,
}))

import { ChatProviderDisconnected } from "../components/chat/ChatProviderDisconnected"

describe("ChatProviderDisconnected", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    codexAuthMocks.connectCodexAccount.mockResolvedValue({ status: "connected" })
    window.electronAPI = {
      codexAuthStart: vi.fn().mockResolvedValue({ status: "connected" as const }),
      getBootstrap: vi.fn().mockResolvedValue(null),
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn().mockReturnValue(() => {}),
    }
  })

  test("renders the card", () => {
    render(<ChatProviderDisconnected />)
    expect(screen.getByTestId("chat-provider-disconnected")).toBeDefined()
  })

  test("shows connect button in idle phase", () => {
    render(<ChatProviderDisconnected />)
    expect(screen.getByTestId("chat-provider-connect-btn").textContent).toBe("Connect ChatGPT")
  })

  test("shows not connected status initially", () => {
    render(<ChatProviderDisconnected />)
    expect(screen.getByTestId("chat-provider-status").textContent).toBe("Not connected")
  })

  test("clicking connect invokes codexAuthStart", async () => {
    const user = userEvent.setup()
    render(<ChatProviderDisconnected />)
    await user.click(screen.getByTestId("chat-provider-connect-btn"))
    expect(codexAuthMocks.connectCodexAccount).toHaveBeenCalledOnce()
  })

  test("calls onConnected after successful auth", async () => {
    const onConnected = vi.fn()
    const user = userEvent.setup()
    render(<ChatProviderDisconnected onConnected={onConnected} />)
    await user.click(screen.getByTestId("chat-provider-connect-btn"))
    expect(onConnected).toHaveBeenCalledOnce()
  })

  test("shows connected status after successful auth", async () => {
    const user = userEvent.setup()
    render(<ChatProviderDisconnected />)
    await user.click(screen.getByTestId("chat-provider-connect-btn"))
    expect(screen.getByTestId("chat-provider-status").textContent).toBe("Connected")
  })

  test("shows error when electronAPI is unavailable", async () => {
    codexAuthMocks.connectCodexAccount.mockResolvedValue({
      status: "failed",
      error: "Desktop bridge unavailable. Please make sure you're running Orbyt as a desktop app.",
    })
    const user = userEvent.setup()
    render(<ChatProviderDisconnected />)
    await user.click(screen.getByTestId("chat-provider-connect-btn"))
    expect(screen.getByTestId("chat-provider-error")).toBeDefined()
    expect(screen.getByTestId("chat-provider-error").textContent).toContain("Desktop bridge unavailable")
  })

  test("shows try again button after error", async () => {
    codexAuthMocks.connectCodexAccount.mockResolvedValue({
      status: "failed",
      error: "Desktop bridge unavailable. Please make sure you're running Orbyt as a desktop app.",
    })
    Reflect.deleteProperty(window, "electronAPI")
    const user = userEvent.setup()
    render(<ChatProviderDisconnected />)
    await user.click(screen.getByTestId("chat-provider-connect-btn"))
    expect(screen.getByTestId("chat-provider-connect-btn").textContent).toBe("Try again")
  })
})
