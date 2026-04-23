import { describe, test, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SkillEditor } from "../components/skills/SkillEditor"

describe("SkillEditor", () => {
  test("allows editing markdown and submits save for editable custom skills", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <SkillEditor
        skill={{
          id: "my-plan",
          name: "My Plan",
          tier: "custom",
          editable: true,
          markdown: "---\nname: my-plan\n---\nOriginal body",
        }}
        onSave={onSave}
        onDelete={() => Promise.resolve()}
      />,
    )

    const textarea = screen.getByRole("textbox", { name: /skill markdown/i }) as HTMLTextAreaElement
    await user.clear(textarea)
    await user.type(textarea, "updated body")

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith({ skillId: "my-plan", markdown: "updated body" })
  })

  test("renders read-only banner and disables Save when skill is not editable (curated)", async () => {
    const onSave = vi.fn()
    render(
      <SkillEditor
        skill={{
          id: "plan-mode",
          name: "Plan Mode",
          tier: "curated",
          editable: false,
          markdown: "curated body",
        }}
        onSave={onSave}
        onDelete={() => Promise.resolve()}
      />,
    )

    expect(screen.getByText(/read-only/i)).toBeDefined()
    const save = screen.getByRole("button", { name: /save/i }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
  })
})
