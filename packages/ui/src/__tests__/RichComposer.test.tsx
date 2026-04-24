import { describe, expect, test, vi } from "vitest"
import { createRef } from "react"
import { act, render } from "@testing-library/react"
import {
  RichComposer,
  type RichComposerHandle,
} from "../components/chat/RichComposer"
import type { SkillPickerEntry } from "../components/chat/SkillPicker"

function typeIntoEditor(editor: HTMLElement, text: string) {
  const textNode = document.createTextNode(text)
  editor.appendChild(textNode)

  const range = document.createRange()
  range.setStart(textNode, text.length)
  range.collapse(true)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)

  editor.dispatchEvent(new InputEvent("input", { bubbles: true }))
}

function getEditor(container: HTMLElement): HTMLElement {
  const editor = container.querySelector('[role="textbox"]')
  if (!(editor instanceof HTMLElement)) {
    throw new Error("editor not found")
  }
  return editor
}

describe("RichComposer @ trigger", () => {
  test("typing @ fires onMentionTrigger with the current filter", () => {
    const ref = createRef<RichComposerHandle>()
    const onMentionTrigger = vi.fn()
    const onSkillTrigger = vi.fn()
    const { container } = render(
      <RichComposer
        ref={ref}
        onMentionTrigger={onMentionTrigger}
        onSkillTrigger={onSkillTrigger}
      />,
    )
    const editor = getEditor(container)

    act(() => {
      typeIntoEditor(editor, "@es")
    })

    const calls = onMentionTrigger.mock.calls
    expect(calls.some(([filter, show]) => show === true && filter === "es")).toBe(true)
  })

  test("typing a space after @ clears the mention trigger", () => {
    const ref = createRef<RichComposerHandle>()
    const onMentionTrigger = vi.fn()
    const { container } = render(
      <RichComposer ref={ref} onMentionTrigger={onMentionTrigger} />,
    )
    const editor = getEditor(container)

    act(() => {
      typeIntoEditor(editor, "@es ")
    })

    const lastCall = onMentionTrigger.mock.calls.at(-1)
    expect(lastCall?.[1]).toBe(false)
  })

  test("typing / still fires onSkillTrigger (regression)", () => {
    const onSkillTrigger = vi.fn()
    const onMentionTrigger = vi.fn()
    const { container } = render(
      <RichComposer
        onSkillTrigger={onSkillTrigger}
        onMentionTrigger={onMentionTrigger}
      />,
    )
    const editor = getEditor(container)

    act(() => {
      typeIntoEditor(editor, "/rev")
    })

    const skillCalls = onSkillTrigger.mock.calls
    expect(skillCalls.some(([filter, show]) => show === true && filter === "rev")).toBe(
      true,
    )
  })
})

describe("RichComposer mention insertion and extraction", () => {
  test("insertAssignment writes a chip whose dataset carries kind, id, label, url", () => {
    const ref = createRef<RichComposerHandle>()
    const onMentionTrigger = vi.fn()
    const { container } = render(
      <RichComposer ref={ref} onMentionTrigger={onMentionTrigger} />,
    )
    const editor = getEditor(container)

    act(() => {
      typeIntoEditor(editor, "@")
    })
    act(() => {
      ref.current?.insertAssignment({
        id: "canvas-course:42:assignment:12345",
        label: "Essay 3",
        url: "https://canvas.example.edu/courses/42/assignments/12345",
      })
    })

    const chip = editor.querySelector(
      '[data-mention-kind="canvas-assignment"]',
    ) as HTMLElement | null
    expect(chip).not.toBeNull()
    expect(chip?.dataset.referenceId).toBe("canvas-course:42:assignment:12345")
    expect(chip?.dataset.label).toBe("Essay 3")
    expect(chip?.dataset.url).toBe(
      "https://canvas.example.edu/courses/42/assignments/12345",
    )
  })

  test("getReferences returns the inserted assignment as a TurnReferenceInput", () => {
    const ref = createRef<RichComposerHandle>()
    const { container } = render(<RichComposer ref={ref} />)
    const editor = getEditor(container)

    act(() => {
      typeIntoEditor(editor, "@")
    })
    act(() => {
      ref.current?.insertAssignment({
        id: "canvas-course:42:assignment:12345",
        label: "Essay 3",
        url: "https://canvas.example.edu/courses/42/assignments/12345",
      })
    })

    const refs = ref.current?.getReferences()
    expect(refs).toEqual([
      {
        kind: "canvas-assignment",
        id: "canvas-course:42:assignment:12345",
        label: "Essay 3",
        url: "https://canvas.example.edu/courses/42/assignments/12345",
      },
    ])
  })

  test("insertFile writes a chip exposed by getAttachments", () => {
    const ref = createRef<RichComposerHandle>()
    const { container } = render(<RichComposer ref={ref} />)
    const editor = getEditor(container)

    act(() => {
      typeIntoEditor(editor, "@")
    })
    act(() => {
      ref.current?.insertFile({
        path: "/abs/draft.md",
        label: "draft.md",
        mimeType: "text/markdown",
        sizeBytes: 123,
        kind: "file",
      })
    })

    const attachments = ref.current?.getAttachments()
    expect(attachments).toEqual([
      {
        path: "/abs/draft.md",
        name: "draft.md",
        mimeType: "text/markdown",
        sizeBytes: 123,
        kind: "file",
      },
    ])
  })

  test("skill chip regression: insertSkill still yields correct skillId", () => {
    const ref = createRef<RichComposerHandle>()
    const { container } = render(<RichComposer ref={ref} />)
    const editor = getEditor(container)

    act(() => {
      typeIntoEditor(editor, "/")
    })
    const skill: SkillPickerEntry = {
      id: "skill_essay_reviewer",
      name: "essay-reviewer",
      description: "Review essays",
    } as SkillPickerEntry
    act(() => {
      ref.current?.insertSkill(skill)
    })

    expect(ref.current?.getSkillId()).toBe("skill_essay_reviewer")
    expect(ref.current?.getReferences()).toEqual([])
    expect(ref.current?.getAttachments()).toEqual([])
  })

  test("mixed chip extraction: skill + assignment + file + text", () => {
    const ref = createRef<RichComposerHandle>()
    const { container } = render(<RichComposer ref={ref} />)
    const editor = getEditor(container)

    act(() => {
      typeIntoEditor(editor, "/")
    })
    act(() => {
      ref.current?.insertSkill({
        id: "skill_1",
        name: "reviewer",
        description: "",
      } as SkillPickerEntry)
    })
    act(() => {
      typeIntoEditor(editor, " @")
    })
    act(() => {
      ref.current?.insertAssignment({
        id: "canvas-course:1:assignment:2",
        label: "Essay",
        url: "https://canvas.example.edu/courses/1/assignments/2",
      })
    })
    act(() => {
      typeIntoEditor(editor, " @")
    })
    act(() => {
      ref.current?.insertFile({
        path: "/tmp/a.md",
        label: "a.md",
      })
    })
    act(() => {
      typeIntoEditor(editor, " tail")
    })

    expect(ref.current?.getSkillId()).toBe("skill_1")
    expect(ref.current?.getReferences()).toHaveLength(1)
    expect(ref.current?.getAttachments()).toHaveLength(1)
    expect(ref.current?.getText()).toContain("tail")
  })
})
