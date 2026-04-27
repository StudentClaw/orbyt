import { describe, expect, test, vi } from "vitest"
import { act, createRef } from "react"
import { render, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  MentionPicker,
  type AssignmentPickerEntry,
  type FilePickerEntry,
  type MentionPickerHandle,
} from "../components/chat/MentionPicker"

const ASSIGNMENT_A: AssignmentPickerEntry = {
  id: "canvas-course:42:assignment:12345",
  label: "Essay 3",
  url: "https://canvas.example.edu/courses/42/assignments/12345",
  courseCode: "ENG 101",
}

const FILE_A: FilePickerEntry = {
  path: "/repo/draft.md",
  label: "draft.md",
  mimeType: "text/markdown",
  sizeBytes: 123,
  kind: "file",
}

const FILE_B: FilePickerEntry = {
  path: "/repo/rubric.md",
  label: "rubric.md",
  mimeType: "text/markdown",
  sizeBytes: 456,
  kind: "file",
}

describe("MentionPicker", () => {
  test("renders both section headers when empty", () => {
    const { getByText } = render(
      <MentionPicker
        filter=""
        assignments={[]}
        files={[]}
        recents={[]}
        canReadCanvas={true}
        onSelectAssignment={() => {}}
        onSelectFile={() => {}}
        onBrowseFiles={() => {}}
      />,
    )
    expect(getByText("Canvas")).toBeTruthy()
    expect(getByText(/files\s*&\s*folders/i)).toBeTruthy()
  })

  test("renders provided entries plus a Browse... row when filter is empty", () => {
    const { getByText } = render(
      <MentionPicker
        filter=""
        assignments={[ASSIGNMENT_A]}
        files={[FILE_A]}
        recents={[]}
        canReadCanvas={true}
        onSelectAssignment={() => {}}
        onSelectFile={() => {}}
        onBrowseFiles={() => {}}
      />,
    )
    expect(getByText("Essay 3")).toBeTruthy()
    expect(getByText("draft.md")).toBeTruthy()
    expect(getByText(/Browse/i)).toBeTruthy()
  })

  test("narrows files by filter and hides assignments that do not match", () => {
    const { queryByText, getByText } = render(
      <MentionPicker
        filter="draft"
        assignments={[ASSIGNMENT_A]}
        files={[FILE_A, FILE_B]}
        recents={[]}
        canReadCanvas={true}
        onSelectAssignment={() => {}}
        onSelectFile={() => {}}
        onBrowseFiles={() => {}}
      />,
    )
    expect(getByText("draft.md")).toBeTruthy()
    expect(queryByText("rubric.md")).toBeNull()
    expect(queryByText("Essay 3")).toBeNull()
  })

  test("typed filters search assignments beyond the empty-state limit", () => {
    const assignments = Array.from({ length: 9 }, (_, index) => ({
      id: `canvas-course:42:assignment:${index + 1}`,
      label: index === 8 ? "Capstone Final" : `Weekly Check ${index + 1}`,
      url: `https://canvas.example.edu/courses/42/assignments/${index + 1}`,
      courseCode: "ENG 101",
    }))
    const { queryByText, rerender } = render(
      <MentionPicker
        filter=""
        assignments={assignments}
        files={[]}
        recents={[]}
        canReadCanvas={true}
        onSelectAssignment={() => {}}
        onSelectFile={() => {}}
        onBrowseFiles={() => {}}
      />,
    )

    expect(queryByText("Capstone Final")).toBeNull()

    rerender(
      <MentionPicker
        filter="capstone"
        assignments={assignments}
        files={[]}
        recents={[]}
        canReadCanvas={true}
        onSelectAssignment={() => {}}
        onSelectFile={() => {}}
        onBrowseFiles={() => {}}
      />,
    )

    expect(queryByText("Capstone Final")).toBeTruthy()
  })

  test("typed filters search assignment course codes", () => {
    const { getByText } = render(
      <MentionPicker
        filter="eng"
        assignments={[ASSIGNMENT_A]}
        files={[]}
        recents={[]}
        canReadCanvas={true}
        onSelectAssignment={() => {}}
        onSelectFile={() => {}}
        onBrowseFiles={() => {}}
      />,
    )

    expect(getByText("Essay 3")).toBeTruthy()
  })

  test("clicking an assignment row calls onSelectAssignment with that assignment", () => {
    const onSelectAssignment = vi.fn()
    const { getByText } = render(
      <MentionPicker
        filter=""
        assignments={[ASSIGNMENT_A]}
        files={[]}
        recents={[]}
        canReadCanvas={true}
        onSelectAssignment={onSelectAssignment}
        onSelectFile={() => {}}
        onBrowseFiles={() => {}}
      />,
    )
    fireEvent.click(getByText("Essay 3"))
    expect(onSelectAssignment).toHaveBeenCalledWith(ASSIGNMENT_A)
  })

  test("clicking Browse... calls onBrowseFiles", () => {
    const onBrowseFiles = vi.fn()
    const { getByText } = render(
      <MentionPicker
        filter=""
        assignments={[]}
        files={[]}
        recents={[]}
        canReadCanvas={true}
        onSelectAssignment={() => {}}
        onSelectFile={() => {}}
        onBrowseFiles={onBrowseFiles}
      />,
    )
    fireEvent.click(getByText(/Browse/i))
    expect(onBrowseFiles).toHaveBeenCalled()
  })

  test("when canReadCanvas is false, assignments section shows Grant access CTA", () => {
    const onRequestCanvasAccess = vi.fn()
    const { getByRole } = render(
      <MentionPicker
        filter=""
        assignments={[]}
        files={[]}
        recents={[]}
        canReadCanvas={false}
        onSelectAssignment={() => {}}
        onSelectFile={() => {}}
        onBrowseFiles={() => {}}
        onRequestCanvasAccess={onRequestCanvasAccess}
      />,
    )
    const grantBtn = getByRole("button", { name: /grant access/i })
    fireEvent.click(grantBtn)
    expect(onRequestCanvasAccess).toHaveBeenCalled()
  })

  test("recents render above non-recent files when filter is empty", () => {
    const recentOnly: FilePickerEntry = {
      path: "/repo/recent.md",
      label: "recent.md",
      mimeType: "text/markdown",
      sizeBytes: 1,
      kind: "file",
    }
    const { container } = render(
      <MentionPicker
        filter=""
        assignments={[]}
        files={[FILE_A]}
        recents={[recentOnly]}
        canReadCanvas={true}
        onSelectAssignment={() => {}}
        onSelectFile={() => {}}
        onBrowseFiles={() => {}}
      />,
    )
    const labels = Array.from(
      container.querySelectorAll("[data-mention-label]"),
    ).map((el) => (el as HTMLElement).dataset.mentionLabel)
    const recentIdx = labels.indexOf("recent.md")
    const draftIdx = labels.indexOf("draft.md")
    expect(recentIdx).toBeGreaterThanOrEqual(0)
    expect(draftIdx).toBeGreaterThan(recentIdx)
  })

  test("clicking a file row calls onSelectFile", () => {
    const onSelectFile = vi.fn()
    const { getByText } = render(
      <MentionPicker
        filter=""
        assignments={[]}
        files={[FILE_A]}
        recents={[]}
        canReadCanvas={true}
        onSelectAssignment={() => {}}
        onSelectFile={onSelectFile}
        onBrowseFiles={() => {}}
      />,
    )
    fireEvent.click(getByText("draft.md"))
    expect(onSelectFile).toHaveBeenCalledWith(FILE_A)
  })

  test("tree preview scopes paths to workspaceRoot when provided", async () => {
    const nested: FilePickerEntry = {
      path: "/Users/paul/Documents/Ch7/notes/lecture1.md",
      label: "lecture1.md",
      mimeType: "text/markdown",
      sizeBytes: 1,
      kind: "file",
    }
    const { getByText, container } = render(
      <MentionPicker
        filter=""
        assignments={[]}
        files={[nested]}
        recents={[]}
        canReadCanvas={true}
        onSelectAssignment={() => {}}
        onSelectFile={() => {}}
        onBrowseFiles={() => {}}
        workspaceRoot="/Users/paul/Documents/Ch7"
      />,
    )
    const row = getByText("lecture1.md").closest(
      "[data-slot='combobox-item']",
    ) as HTMLElement
    const user = userEvent.setup()
    await user.hover(row)
    const tree = container.querySelector(
      "[data-testid='file-path-tree']",
    ) as HTMLElement
    expect(tree).toBeTruthy()
    const text = tree.textContent ?? ""
    expect(text).toContain("notes")
    expect(text).toContain("lecture1.md")
    expect(text).not.toContain("Users")
    expect(text).not.toContain("Documents")
    expect(text).not.toContain("Ch7")
  })

  test("hovering a file surfaces the path tree preview", async () => {
    const nested: FilePickerEntry = {
      path: "/repo/packages/contracts/src/schemas/index.ts",
      label: "index.ts",
      mimeType: "text/typescript",
      sizeBytes: 1,
      kind: "file",
    }
    const { getByText, queryByTestId, container } = render(
      <MentionPicker
        filter=""
        assignments={[]}
        files={[nested]}
        recents={[]}
        canReadCanvas={true}
        onSelectAssignment={() => {}}
        onSelectFile={() => {}}
        onBrowseFiles={() => {}}
      />,
    )
    expect(queryByTestId("mention-picker-preview")).toBeNull()
    const row = (getByText("index.ts").closest("[data-mention-kind='file']") ??
      getByText("index.ts").closest("[data-slot='combobox-item']")) as HTMLElement
    expect(row).toBeTruthy()
    const user = userEvent.setup()
    await user.hover(row)
    const tree = container.querySelector("[data-testid='file-path-tree']")
    expect(tree).toBeTruthy()
    expect(tree?.textContent).toContain("packages")
    expect(tree?.textContent).toContain("contracts")
    expect(tree?.textContent).toContain("schemas")
    expect(tree?.textContent).toContain("index.ts")
  })

  test("imperative handle moves highlight and selects across sections", () => {
    const onSelectAssignment = vi.fn()
    const onSelectFile = vi.fn()
    const onBrowseFiles = vi.fn()
    const ref = createRef<MentionPickerHandle>()
    render(
      <MentionPicker
        ref={ref}
        filter=""
        assignments={[ASSIGNMENT_A]}
        files={[FILE_A]}
        recents={[]}
        canReadCanvas={true}
        onSelectAssignment={onSelectAssignment}
        onSelectFile={onSelectFile}
        onBrowseFiles={onBrowseFiles}
      />,
    )
    expect(ref.current).toBeTruthy()
    expect(ref.current!.hasHighlight()).toBe(true)
    act(() => {
      ref.current!.selectHighlighted()
    })
    expect(onSelectAssignment).toHaveBeenCalledWith(ASSIGNMENT_A)
    act(() => {
      ref.current!.moveHighlight(1)
    })
    act(() => {
      ref.current!.selectHighlighted()
    })
    expect(onSelectFile).toHaveBeenCalledWith(FILE_A)
    act(() => {
      ref.current!.moveHighlight(1)
    })
    act(() => {
      ref.current!.selectHighlighted()
    })
    expect(onBrowseFiles).toHaveBeenCalled()
    act(() => {
      ref.current!.moveHighlight(1)
    })
    act(() => {
      ref.current!.selectHighlighted()
    })
    expect(onSelectAssignment).toHaveBeenCalledTimes(2)
  })

  test("file row path display is scoped to workspaceRoot", () => {
    const nested: FilePickerEntry = {
      path: "/Users/paul/Documents/Ch7/notes/lecture1.md",
      label: "lecture1.md",
      mimeType: "text/markdown",
      sizeBytes: 1,
      kind: "file",
    }
    const { container } = render(
      <MentionPicker
        filter=""
        assignments={[]}
        files={[nested]}
        recents={[]}
        canReadCanvas={true}
        onSelectAssignment={() => {}}
        onSelectFile={() => {}}
        onBrowseFiles={() => {}}
        workspaceRoot="/Users/paul/Documents/Ch7"
      />,
    )
    const pathSpan = container.querySelector(
      "[data-testid='file-row-path']",
    ) as HTMLElement | null
    expect(pathSpan).toBeTruthy()
    expect(pathSpan!.textContent).toBe("notes/lecture1.md")
  })

  test("file row path falls back to absolute path for files outside workspace", () => {
    const external: FilePickerEntry = {
      path: "/tmp/other/file.txt",
      label: "file.txt",
      kind: "file",
    }
    const { container } = render(
      <MentionPicker
        filter=""
        assignments={[]}
        files={[external]}
        recents={[]}
        canReadCanvas={true}
        onSelectAssignment={() => {}}
        onSelectFile={() => {}}
        onBrowseFiles={() => {}}
        workspaceRoot="/Users/paul/Documents/Ch7"
      />,
    )
    const pathSpan = container.querySelector(
      "[data-testid='file-row-path']",
    ) as HTMLElement | null
    expect(pathSpan?.textContent).toBe("/tmp/other/file.txt")
  })

  test("does not crash on undefined array-shaped props", () => {
    const { container } = render(
      <MentionPicker
        filter=""
        assignments={undefined as unknown as readonly AssignmentPickerEntry[]}
        files={undefined as unknown as readonly FilePickerEntry[]}
        recents={undefined as unknown as readonly FilePickerEntry[]}
        canReadCanvas={true}
        onSelectAssignment={() => {}}
        onSelectFile={() => {}}
        onBrowseFiles={() => {}}
      />,
    )
    expect(container).toBeTruthy()
  })
})
