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
    pageMocks.createThread.mockResolvedValue("thread-1")
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
      workspaces: [{ id: "workspace-1" }],
    }
  })

  test("renders preview metadata, loads details, and shows the assignment body", () => {
    render(<AssignmentDetailPage assignmentId="item-1" />)

    expect(pageMocks.loadAssignmentDetail).toHaveBeenCalledWith("item-1")
    expect(screen.getByTestId("assignment-detail-title").textContent).toBe("Final Paper")
    expect(screen.getByText("Write a close reading of one myth.")).toBeDefined()
    expect(screen.getByText("Open in Canvas")).toBeDefined()
  })

  test("launches a seeded chat thread from a quick action", async () => {
    const user = userEvent.setup()
    render(<AssignmentDetailPage assignmentId="item-1" />)

    await user.click(screen.getByRole("button", { name: "Draft Assignment" }))

    expect(pageMocks.createThread).toHaveBeenCalledWith("workspace-1", "Draft Assignment: Final Paper")
    expect(pageMocks.sendTurn).toHaveBeenCalledTimes(1)
    expect(String(pageMocks.sendTurn.mock.calls[0]?.[1])).toContain("Final Paper")
    expect(String(pageMocks.sendTurn.mock.calls[0]?.[1])).toContain("Write a close reading of one myth.")
    expect(pageMocks.navigate).toHaveBeenCalledWith({
      to: "/chat/$workspaceId/$threadId",
      params: {
        workspaceId: "workspace-1",
        threadId: "thread-1",
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
