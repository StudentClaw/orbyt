import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ChatStatus } from "@/hooks/chat-model"
import { ChatStatusBadge } from "../components/chat/ChatStatusBadge"

describe("ChatStatusBadge", () => {
  test("renders Queued state without crashing (regression)", () => {
    render(<ChatStatusBadge status="queued" />)
    const badge = screen.getByTestId("chat-status-badge")
    expect(badge.textContent).toBe("Queued")
    expect(badge.innerHTML).toContain("bg-sky-500")
  })

  test("renders a neutral fallback for an unmapped status instead of white-screening", () => {
    render(<ChatStatusBadge status={"not-a-real-status" as ChatStatus} />)
    const badge = screen.getByTestId("chat-status-badge")
    expect(badge.textContent).toBe("Unknown")
    expect(badge.innerHTML).toContain("bg-muted-foreground/60")
  })

  test("renders the idle (Ready) state", () => {
    render(<ChatStatusBadge status="idle" />)
    expect(screen.getByTestId("chat-status-badge").textContent).toBe("Ready")
  })
})
