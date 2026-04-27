import { describe, test, expect, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
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

  describe("mention support (Phase 06)", () => {
    const assignmentMd =
      "Review [Essay 3](https://canvas.example.edu/courses/42/assignments/12345) carefully"

    test("renders a chip strip for each parsed assignment mention in the markdown", () => {
      render(
        <SkillEditor
          skill={{
            id: "reviewer",
            name: "Reviewer",
            tier: "custom",
            editable: true,
            markdown: assignmentMd,
          }}
          onSave={vi.fn()}
          onDelete={() => Promise.resolve()}
        />,
      )
      const strip = screen.getByTestId("skill-editor-mention-chips")
      expect(within(strip).getByText("Essay 3")).toBeTruthy()
      const chip = strip.querySelector("[data-mention-kind]") as HTMLElement | null
      expect(chip?.dataset.mentionKind).toBe("canvas-assignment")
      expect(chip?.dataset.mentionLabel).toBe("Essay 3")
    })

    test("unrelated markdown links do not render chips", () => {
      render(
        <SkillEditor
          skill={{
            id: "reviewer",
            name: "Reviewer",
            tier: "custom",
            editable: true,
            markdown: "See [docs](https://example.com/readme) for details",
          }}
          onSave={vi.fn()}
          onDelete={() => Promise.resolve()}
        />,
      )
      expect(screen.queryByTestId("skill-editor-mention-chips")).toBeNull()
    })

    test("inserting an assignment writes a canonical markdown link and save passes raw markdown", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      const user = userEvent.setup()
      const assignment = {
        id: "canvas-course:42:assignment:12345",
        label: "Essay 3",
        url: "https://canvas.example.edu/courses/42/assignments/12345",
      }
      render(
        <SkillEditor
          skill={{
            id: "reviewer",
            name: "Reviewer",
            tier: "custom",
            editable: true,
            markdown: "",
          }}
          assignments={[assignment]}
          onSave={onSave}
          onDelete={() => Promise.resolve()}
        />,
      )

      await user.click(screen.getByRole("button", { name: /insert mention/i }))
      const picker = await screen.findByTestId("skill-editor-mention-picker")
      await user.click(within(picker).getByText("Essay 3"))

      const textarea = screen.getByRole("textbox", { name: /skill markdown/i }) as HTMLTextAreaElement
      expect(textarea.value).toBe(
        "[Essay 3](https://canvas.example.edu/courses/42/assignments/12345)",
      )

      await user.click(screen.getByRole("button", { name: /^save/i }))
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
      expect(onSave).toHaveBeenCalledWith({
        skillId: "reviewer",
        markdown: "[Essay 3](https://canvas.example.edu/courses/42/assignments/12345)",
      })
    })

    test("curated skill hides Insert mention button but still shows chips", () => {
      render(
        <SkillEditor
          skill={{
            id: "reviewer",
            name: "Reviewer",
            tier: "curated",
            editable: false,
            markdown: assignmentMd,
          }}
          onSave={vi.fn()}
          onDelete={() => Promise.resolve()}
        />,
      )
      expect(screen.queryByRole("button", { name: /insert mention/i })).toBeNull()
      const strip = screen.getByTestId("skill-editor-mention-chips")
      expect(within(strip).getByText("Essay 3")).toBeTruthy()
    })

    test("round-trip: editing preserves the existing mention link byte-for-byte", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      const user = userEvent.setup()
      const original =
        "Header\n\n[Essay 3](https://canvas.example.edu/courses/42/assignments/12345)\n"
      render(
        <SkillEditor
          skill={{
            id: "reviewer",
            name: "Reviewer",
            tier: "custom",
            editable: true,
            markdown: original,
          }}
          onSave={onSave}
          onDelete={() => Promise.resolve()}
        />,
      )
      const textarea = screen.getByRole("textbox", {
        name: /skill markdown/i,
      }) as HTMLTextAreaElement
      await user.click(textarea)
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      await user.type(textarea, "x")
      await user.click(screen.getByRole("button", { name: /^save/i }))
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
      expect(onSave).toHaveBeenCalledWith({
        skillId: "reviewer",
        markdown: original + "x",
      })
    })
  })
})
