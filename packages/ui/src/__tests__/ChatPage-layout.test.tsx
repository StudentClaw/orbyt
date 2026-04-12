import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const pageMocks = vi.hoisted(() => ({
  pathname: "/chat",
  navigate: vi.fn(),
  snapshot: null,
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => pageMocks.navigate,
  useRouterState: ({ select }: { select?: (state: { location: { pathname: string } }) => unknown } = {}) => {
    const state = { location: { pathname: pageMocks.pathname } }
    return select ? select(state) : state
  },
}))

vi.mock("@/hooks/useAppRuntime", () => ({
  useRuntimeOrchestrationSnapshot: () => pageMocks.snapshot,
}))

vi.mock("@/components/chat/ChatContainer", () => ({
  ChatContainer: () => <div data-testid="chat-container" />,
}))

vi.mock("@/components/shell/ChatHistory", () => ({
  ChatHistory: () => <div data-testid="chat-history" />,
}))

import { ChatPage } from "../pages/ChatPage"

describe("ChatPage layout", () => {
  beforeEach(() => {
    pageMocks.pathname = "/chat"
    pageMocks.navigate.mockReset()
    pageMocks.snapshot = null
  })

  test("renders the in-page chat browser and main chat pane", () => {
    render(<ChatPage />)

    expect(screen.getByTestId("chat-container")).toBeDefined()
    expect(screen.queryByTestId("chat-history")).toBeNull()
  })
})
