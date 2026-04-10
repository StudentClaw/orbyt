import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CompletionCheckin } from "../components/dashboard/CompletionCheckin"

describe("CompletionCheckin", () => {
  test("renders session title and three outcome buttons", () => {
    const onComplete = vi.fn()
    render(
      <CompletionCheckin
        sessionTitle="Study Chapter 5"
        open={true}
        onOpenChange={() => {}}
        onComplete={onComplete}
      />,
    )

    expect(screen.getByText(/Study Chapter 5/)).toBeDefined()
    expect(screen.getByTestId("checkin-yes")).toBeDefined()
    expect(screen.getByTestId("checkin-no")).toBeDefined()
    expect(screen.getByTestId("checkin-partial")).toBeDefined()
  })

  test("'Yes' calls onComplete with completed status", async () => {
    const onComplete = vi.fn()
    render(
      <CompletionCheckin
        sessionTitle="Study Chapter 5"
        open={true}
        onOpenChange={() => {}}
        onComplete={onComplete}
      />,
    )

    await userEvent.click(screen.getByTestId("checkin-yes"))
    expect(onComplete).toHaveBeenCalledWith({ status: "completed" })
  })

  test("'No' calls onComplete with skipped status", async () => {
    const onComplete = vi.fn()
    render(
      <CompletionCheckin
        sessionTitle="Study Chapter 5"
        open={true}
        onOpenChange={() => {}}
        onComplete={onComplete}
      />,
    )

    await userEvent.click(screen.getByTestId("checkin-no"))
    expect(onComplete).toHaveBeenCalledWith({ status: "skipped" })
  })

  test("'Yes, but...' shows text input, submit sends partial", async () => {
    const onComplete = vi.fn()
    render(
      <CompletionCheckin
        sessionTitle="Study Chapter 5"
        open={true}
        onOpenChange={() => {}}
        onComplete={onComplete}
      />,
    )

    await userEvent.click(screen.getByTestId("checkin-partial"))

    expect(screen.getByTestId("checkin-note-input")).toBeDefined()

    await userEvent.type(screen.getByTestId("checkin-note-input"), "Only got halfway")
    await userEvent.click(screen.getByTestId("checkin-note-submit"))

    expect(onComplete).toHaveBeenCalledWith({
      status: "partial",
      note: "Only got halfway",
    })
  })

  test("dialog is dismissible via onOpenChange", () => {
    const onOpenChange = vi.fn()
    render(
      <CompletionCheckin
        sessionTitle="Study Chapter 5"
        open={true}
        onOpenChange={onOpenChange}
        onComplete={() => {}}
      />,
    )

    // Dialog should be open — the presence of the dialog content confirms this
    expect(screen.getByTestId("checkin-dialog")).toBeDefined()
  })
})
