import { describe, test, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SkillForkDialog } from "../components/skills/SkillForkDialog"

describe("SkillForkDialog", () => {
  test("pre-fills the target slug with <source>-fork and submits sourceSlug + targetSlug on confirm", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <SkillForkDialog
        open
        sourceSlug="plan-mode"
        sourceName="Plan Mode"
        sourceVersion="1.0.0"
        onConfirm={onConfirm}
        onOpenChange={() => undefined}
      />,
    )

    const slugInput = screen.getByLabelText(/slug/i) as HTMLInputElement
    expect(slugInput.value).toBe("plan-mode-fork")

    await user.clear(slugInput)
    await user.type(slugInput, "my-plan")

    const displayName = screen.getByLabelText(/display name/i) as HTMLInputElement
    await user.clear(displayName)
    await user.type(displayName, "My Plan")

    await user.click(screen.getByRole("button", { name: /create fork/i }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm).toHaveBeenCalledWith({
      sourceSlug: "plan-mode",
      targetSlug: "my-plan",
      displayName: "My Plan",
    })
  })

  test("disables Create fork and shows an inline error for invalid slug characters", async () => {
    render(
      <SkillForkDialog
        open
        sourceSlug="plan-mode"
        sourceName="Plan Mode"
        sourceVersion="1.0.0"
        onConfirm={() => Promise.resolve()}
        onOpenChange={() => undefined}
      />,
    )

    const slugInput = screen.getByLabelText(/slug/i) as HTMLInputElement
    fireEvent.change(slugInput, { target: { value: "BAD Slug!" } })

    const submit = screen.getByRole("button", { name: /create fork/i }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    expect(screen.getByText(/lowercase letters.*numbers.*dashes/i)).toBeDefined()
  })
})
