import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AssignmentDetailPage } from "../pages/AssignmentDetailPage"

const pageMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  createThread: vi.fn(),
  sendTurn: vi.fn(),
  loadAssignmentDetail: vi.fn(),
  entry: {
    preview: {
      assignmentId: "item-1",
      title: "Final Paper",
      courseId: "course-1",
      courseCode: "HUM 50",
      courseName: "Mythology",
      effectiveDueAt: "2026-05-17T06:59:00Z",
      pointsPossible: 100,
      submissionStatus: "not_submitted",
      grade: "A- (94/100)",
      htmlUrl: "https://canvas.example.edu/courses/1/assignments/101",
      sourceId: "101",
    },
    detail: {
      course: {
        id: "course-1",
        code: "HUM 50",
        name: "Mythology",
      },
      item: {
        id: "item-1",
        courseId: "course-1",
        title: "Final Paper",
        sourceType: "assignment",
        sourceId: "101",
        freshnessStatus: "fresh",
      },
      source: {
        id: 101,
        course_id: 1,
        name: "Final Paper",
        description: "<p>Write a close reading of one myth.</p>" as string | null,
      },
      grade: undefined,
    },
    status: "success",
    error: null,
  },
  snapshot: {
    workspaces: [
      {
        id: "workspace-1",
        name: "calendar",
      },
      {
        id: "workspace-2",
        name: "algorithms",
      },
    ],
    threads: [
      {
        id: "thread-1",
        workspaceId: "workspace-1",
        title: "Calendar planning",
        accessMode: "default",
        status: "idle",
        createdAt: "2026-04-22T20:00:00.000Z",
        currentTurnId: null,
      },
      {
        id: "thread-2",
        workspaceId: "workspace-2",
        title: "Binary trees lab",
        accessMode: "default",
        status: "idle",
        createdAt: "2026-04-22T18:00:00.000Z",
        currentTurnId: null,
      },
    ],
  },
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => pageMocks.navigate,
}))

vi.mock("../hooks/useAppRuntime", () => ({
  useRuntimeOrchestrationSnapshot: () => pageMocks.snapshot,
  useOrchestrationActions: () => ({
    createThread: pageMocks.createThread,
    sendTurn: pageMocks.sendTurn,
  }),
}))

vi.mock("../rpc/assignmentDetailState", () => ({
  loadAssignmentDetail: pageMocks.loadAssignmentDetail,
  useAssignmentDetailEntry: () => pageMocks.entry,
}))

describe("AssignmentDetailPage", () => {
  beforeEach(() => {
    pageMocks.navigate.mockReset()
    pageMocks.createThread.mockReset()
    pageMocks.sendTurn.mockReset()
    pageMocks.loadAssignmentDetail.mockReset()
    pageMocks.sendTurn.mockResolvedValue(undefined)
    pageMocks.navigate.mockResolvedValue(undefined)
    pageMocks.entry = {
      preview: {
        assignmentId: "item-1",
        title: "Final Paper",
        courseId: "course-1",
        courseCode: "HUM 50",
        courseName: "Mythology",
        effectiveDueAt: "2026-05-17T06:59:00Z",
        pointsPossible: 100,
        submissionStatus: "not_submitted",
        grade: "A- (94/100)",
        htmlUrl: "https://canvas.example.edu/courses/1/assignments/101",
        sourceId: "101",
      },
      detail: {
        course: {
          id: "course-1",
          code: "HUM 50",
          name: "Mythology",
        },
        item: {
          id: "item-1",
          courseId: "course-1",
          title: "Final Paper",
          sourceType: "assignment",
          sourceId: "101",
          freshnessStatus: "fresh",
        },
        source: {
          id: 101,
          course_id: 1,
          name: "Final Paper",
          description: "<p>Write a close reading of one myth.</p>" as string | null,
        },
        grade: undefined,
      },
      status: "success",
      error: null,
    }
    pageMocks.snapshot = {
      workspaces: [
        { id: "workspace-1", name: "calendar" },
        { id: "workspace-2", name: "algorithms" },
      ],
      threads: [
        {
          id: "thread-1",
          workspaceId: "workspace-1",
          title: "Calendar planning",
          accessMode: "default",
          status: "idle",
          createdAt: "2026-04-22T20:00:00.000Z",
          currentTurnId: null,
        },
        {
          id: "thread-2",
          workspaceId: "workspace-2",
          title: "Binary trees lab",
          accessMode: "default",
          status: "idle",
          createdAt: "2026-04-22T18:00:00.000Z",
          currentTurnId: null,
        },
      ],
    }
  })

  test("renders preview metadata, loads details, and shows the assignment body", () => {
    render(<AssignmentDetailPage assignmentId="item-1" />)

    expect(pageMocks.loadAssignmentDetail).toHaveBeenCalledWith("item-1")
    expect(screen.getByTestId("assignment-detail-title").textContent).toBe("Final Paper")
    expect(screen.getByText("Write a close reading of one myth.")).toBeDefined()
    expect(screen.getByText("Open in Canvas")).toBeDefined()
  })

  test("forwards a seeded assignment prompt into the selected chat thread", async () => {
    const user = userEvent.setup()
    render(<AssignmentDetailPage assignmentId="item-1" />)

    await user.click(screen.getByRole("button", { name: "Draft Assignment" }))
    await user.type(screen.getByPlaceholderText("Search chats or folders..."), "binary")
    await user.click(screen.getByText("Binary trees lab"))

    expect(pageMocks.createThread).not.toHaveBeenCalled()
    expect(pageMocks.sendTurn).toHaveBeenCalledTimes(1)
    expect(pageMocks.sendTurn).toHaveBeenCalledWith(
      "thread-2",
      expect.stringContaining("Final Paper"),
      [],
      null,
      null,
    )
    expect(String(pageMocks.sendTurn.mock.calls[0]?.[1])).toContain("Final Paper")
    expect(String(pageMocks.sendTurn.mock.calls[0]?.[1])).toContain("Write a close reading of one myth.")
    expect(pageMocks.navigate).toHaveBeenCalledWith({
      to: "/chat/$workspaceId/$threadId",
      params: {
        workspaceId: "workspace-2",
        threadId: "thread-2",
      },
    })
  })

  test("spawns a new chat in the selected workspace when 'New chat' is chosen", async () => {
    pageMocks.createThread.mockResolvedValue("thread-new")
    const user = userEvent.setup()
    render(<AssignmentDetailPage assignmentId="item-1" />)

    await user.click(screen.getByRole("button", { name: "Plan Assignment" }))
    await user.click(screen.getByTestId("assignment-new-thread-workspace-2"))

    expect(pageMocks.createThread).toHaveBeenCalledTimes(1)
    expect(pageMocks.createThread).toHaveBeenCalledWith("workspace-2", "Plan Assignment")
    expect(pageMocks.sendTurn).toHaveBeenCalledTimes(1)
    expect(pageMocks.sendTurn).toHaveBeenCalledWith(
      "thread-new",
      expect.stringContaining("Final Paper"),
      [],
      null,
      null,
    )
    expect(pageMocks.navigate).toHaveBeenCalledWith({
      to: "/chat/$workspaceId/$threadId",
      params: {
        workspaceId: "workspace-2",
        threadId: "thread-new",
      },
    })
  })

  test("still offers a 'New chat' option for workspaces that have no chats yet", async () => {
    pageMocks.snapshot = {
      workspaces: [{ id: "workspace-1", name: "calendar" }],
      threads: [],
    }
    pageMocks.createThread.mockResolvedValue("thread-new")
    const user = userEvent.setup()
    render(<AssignmentDetailPage assignmentId="item-1" />)

    const quickAction = screen.getByRole("button", { name: "Explain Requirements" })
    expect(quickAction.hasAttribute("disabled")).toBe(false)

    await user.click(quickAction)
    await user.click(screen.getByTestId("assignment-new-thread-workspace-1"))

    expect(pageMocks.createThread).toHaveBeenCalledWith("workspace-1", "Explain Requirements")
    expect(pageMocks.sendTurn).toHaveBeenCalledWith(
      "thread-new",
      expect.stringContaining("Final Paper"),
      [],
      null,
      null,
    )
    expect(pageMocks.navigate).toHaveBeenCalledWith({
      to: "/chat/$workspaceId/$threadId",
      params: {
        workspaceId: "workspace-1",
        threadId: "thread-new",
      },
    })
  })

  test("shows an empty-state fallback when description is unavailable", () => {
    pageMocks.entry = {
      ...pageMocks.entry,
      detail: {
        ...pageMocks.entry.detail,
        source: {
          ...pageMocks.entry.detail.source,
          description: null,
        },
      },
    }

    render(<AssignmentDetailPage assignmentId="item-1" />)

    expect(screen.getByText("Full assignment instructions weren't available from Canvas for this item.")).toBeDefined()
  })
})
