import { describe, expect, test } from "bun:test"
import { Database as BunDatabase } from "bun:sqlite"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type {
  CanvasAssignmentDetailsResult,
  GatewayToolCallResult,
} from "@orbyt/contracts"
import type { PluginGatewayService } from "../mcp/PluginGateway.js"
import type { PushBusService } from "../ws/PushBus.js"
import type { DatabaseService } from "../db/Database.js"
import { createSyncService } from "../canvas/CanvasSyncService.js"
import type { CanvasApiClient } from "../canvas/CanvasApiClient.js"
import { createMemoryPaths } from "../memory/paths.js"
import { createBunDatabaseService, runBunMigrations } from "./db-test-helpers.js"

// Bridges the existing gateway stubs (which dispatch on `canvas.*` tool
// names with a structuredContent payload) to the new CanvasApiClient
// interface. Lets us keep the test setups intact while CanvasSyncService
// switches from gateway-routed tool calls to direct API client method calls.
function gatewayStubAsApiClient(gateway: PluginGatewayService): CanvasApiClient {
  async function call(toolName: string, args: Record<string, unknown> = {}) {
    const result = await gateway.callTool(toolName, args)
    if (!result.ok) {
      throw new Error(result.message)
    }
    const payload = result.result
    if (payload && typeof payload === "object") {
      // The gateway's tool-call envelope can carry an in-band `isError`
      // signal (e.g., for permission failures the plugin handler surfaces).
      // Treat that the same way the previous callDecodedTool helper did:
      // throw, so optional Promise.allSettled paths correctly mark the
      // entry as rejected.
      if ((payload as { isError?: unknown }).isError === true) {
        const content = (payload as { content?: Array<{ text?: string }> }).content
        const text = content?.find((entry) => typeof entry.text === "string")?.text
        throw new Error(text ?? `${toolName} returned a tool error.`)
      }
      if ("structuredContent" in payload) {
        return (payload as { structuredContent: unknown }).structuredContent
      }
    }
    return payload
  }

  return {
    listCourses: async () => call("canvas.list_courses"),
    getMyUpcomingAssignments: async (args?: { days?: number }) =>
      call("canvas.get_my_upcoming_assignments", args ?? {}),
    getMySubmissionStatus: async (args?: { courseId?: string }) =>
      call("canvas.get_my_submission_status", args ?? {}),
    getMyCourseGrades: async () => call("canvas.get_my_course_grades"),
    getMyTodoItems: async () => call("canvas.get_my_todo_items"),
    getMyPeerReviewsTodo: async (args?: { courseId?: string }) =>
      call("canvas.get_my_peer_reviews_todo", args ?? {}),
    getAssignmentDetails: async (args: Record<string, unknown>) =>
      call("canvas.get_assignment_details", args),
    listAssignments: async (args?: { courseId?: string; includeCompleted?: boolean }) =>
      call("canvas.list_assignments", args ?? {}),
    getCourseContentOverview: async (args?: { courseId?: string }) =>
      call("canvas.get_course_content_overview", args ?? {}),
    getCourseStructure: async (args?: { courseId?: string }) =>
      call("canvas.get_course_structure", args ?? {}),
    getFrontPage: async (args: { courseId: string }) =>
      call("canvas.get_front_page", args),
    getPageContent: async (args: { courseId: string; pageId: string }) =>
      call("canvas.get_page_content", args),
    downloadCourseFile: async (args: {
      courseId: string
      fileId: string
      destinationPath?: string
    }) => call("canvas.download_course_file", args),
  } as unknown as CanvasApiClient
}

function createDatabaseService(db: BunDatabase): DatabaseService {
  return createBunDatabaseService(db)
}

function createPushBusStub(): {
  readonly pushBus: PushBusService
  readonly events: Array<{ channel: string; data: unknown }>
} {
  const events: Array<{ channel: string; data: unknown }> = []

  return {
    pushBus: {
      registerClient: () => undefined,
      removeClient: () => undefined,
      subscribe: () => undefined,
      publish: async (channel, data) => {
        events.push({ channel, data })
        return events.length
      },
      publishTo: async (_ws, channel, data) => {
        events.push({ channel, data })
        return events.length
      },
      getLastSequence: () => events.length,
    },
    events,
  }
}

function createGatewayStub(
  callTool: PluginGatewayService["callTool"],
): PluginGatewayService {
  return {
    getInventory: async () => ({
      revision: 0,
      observedAt: new Date(0).toISOString(),
      tools: [],
    }),
    callTool,
    subscribeToolsChanged: () => () => undefined,
    dispose: async () => undefined,
  }
}

function createSuccess(
  exposedToolName: string,
  rawToolName: string,
  result: unknown,
): GatewayToolCallResult {
  return {
    ok: true,
    exposedToolName,
    pluginId: "canvas-mcp",
    rawToolName,
    result,
  }
}

function createEmptyMemoryPaths() {
  return createMemoryPaths({
    env: { ORBYT_HOME: mkdtempSync(join(tmpdir(), "orbyt-canvas-sync-memory-")) },
  })
}

describe("CanvasSyncService", () => {
  test("syncs student-first Canvas state from the updated MCP tool surface", async () => {
    const db = new BunDatabase(":memory:")
    runBunMigrations(db)

    const database = createDatabaseService(db)
    const { pushBus, events } = createPushBusStub()
    const toolCalls: string[] = []

    const gateway = createGatewayStub(async (exposedToolName, args) => {
      toolCalls.push(exposedToolName)

      if (exposedToolName === "canvas.list_courses") {
        return createSuccess(exposedToolName, "list_courses", {
          structuredContent: {
            courses: [
              {
                id: "canvas-course:1",
                name: "Algorithms",
                code: "CS101",
                professor: "Dr. Ada",
                canvasId: "1",
                term: "Spring 2026",
                lastSyncAt: "2026-04-16T00:00:00.000Z",
              },
            ],
          },
        })
      }

      if (exposedToolName === "canvas.get_my_upcoming_assignments") {
        return createSuccess(exposedToolName, "get_my_upcoming_assignments", {
          structuredContent: {
            items: [
              {
                id: "canvas-coursework:assignment:1:101",
                courseId: "canvas-course:1",
                title: "Problem Set 1",
                effectiveDueAt: "2026-04-20T23:59:00.000Z",
                sourceType: "assignment",
                sourceId: "101",
                freshnessStatus: "fresh",
                htmlUrl: "https://canvas.example.edu/courses/1/assignments/101",
                pointsPossible: 10,
                submissionStatus: "not_submitted",
              },
            ],
          },
        })
      }

      if (exposedToolName === "canvas.get_my_submission_status") {
        expect(args).toEqual({})
        return createSuccess(exposedToolName, "get_my_submission_status", {
          structuredContent: {
            submitted: [],
            pending: [
              {
                id: "canvas-coursework:assignment:1:101",
                courseId: "canvas-course:1",
                title: "Problem Set 1",
                effectiveDueAt: "2026-04-20T23:59:00.000Z",
                sourceType: "assignment",
                sourceId: "101",
                freshnessStatus: "fresh",
                htmlUrl: "https://canvas.example.edu/courses/1/assignments/101",
                pointsPossible: 10,
                submissionStatus: "not_submitted",
              },
            ],
            overdue: [],
          },
        })
      }

      if (exposedToolName === "canvas.get_my_course_grades") {
        return createSuccess(exposedToolName, "get_my_course_grades", {
          structuredContent: {
            courses: [
              {
                course: {
                  id: "canvas-course:1",
                  name: "Algorithms",
                  code: "CS101",
                  professor: "Dr. Ada",
                  canvasId: "1",
                  term: "Spring 2026",
                },
                currentScore: 92,
                currentGrade: "A-",
                finalScore: 92,
                finalGrade: "A-",
              },
            ],
          },
        })
      }

      if (exposedToolName === "canvas.get_my_todo_items") {
        return createSuccess(exposedToolName, "get_my_todo_items", {
          structuredContent: {
            items: [
              {
                courseId: "canvas-course:1",
                title: "Read chapter 6",
                type: "assignment",
                dueAt: "2026-04-19T18:00:00.000Z",
                htmlUrl: "https://canvas.example.edu/courses/1/assignments/102",
              },
            ],
          },
        })
      }

      if (exposedToolName === "canvas.get_my_peer_reviews_todo") {
        return createSuccess(exposedToolName, "get_my_peer_reviews_todo", {
          structuredContent: {
            items: [
              {
                courseId: "canvas-course:1",
                assignmentId: "101",
                assignmentName: "Problem Set 1",
                workflowState: "assigned",
              },
              {
                courseId: "canvas-course:1",
                assignmentId: "101",
                assignmentName: "Problem Set 1",
                workflowState: "assigned",
              },
            ],
          },
        })
      }

      throw new Error(`Unexpected tool call: ${exposedToolName}`)
    })

    const service = createSyncService(gatewayStubAsApiClient(gateway), pushBus, database, createEmptyMemoryPaths())

    await service.sync()

    expect(toolCalls).toEqual([
      "canvas.list_courses",
      "canvas.get_my_upcoming_assignments",
      "canvas.get_my_submission_status",
      "canvas.get_my_course_grades",
      "canvas.get_my_todo_items",
      "canvas.get_my_peer_reviews_todo",
    ])
    expect(service.listCourses()).toHaveLength(1)
    expect(service.getMyUpcomingAssignments()).toEqual([
      expect.objectContaining({
        id: "canvas-coursework:assignment:1:101",
        courseId: "canvas-course:1",
      }),
    ])
    expect(service.getMySubmissionStatus()).toEqual({
      submitted: [],
      pending: [expect.objectContaining({ id: "canvas-coursework:assignment:1:101" })],
      overdue: [],
    })
    expect(service.getMyCourseGrades()).toEqual([
      expect.objectContaining({
        currentGrade: "A-",
        currentScore: 92,
      }),
    ])
    expect(service.getMyTodoItems()).toEqual([
      expect.objectContaining({ title: "Read chapter 6" }),
    ])
    expect(service.getMyPeerReviewsTodo()).toEqual([
      expect.objectContaining({ assignmentId: "101" }),
    ])
    expect(events.at(-1)).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        status: "done",
        progress: 100,
      }),
    }))

    database.close()
  })

  test("archived Canvas assignments stay hidden after sync returns them again", async () => {
    const db = new BunDatabase(":memory:")
    runBunMigrations(db)

    const database = createDatabaseService(db)
    const { pushBus } = createPushBusStub()

    const gateway = createGatewayStub(async (exposedToolName) => {
      if (exposedToolName === "canvas.list_courses") {
        return createSuccess(exposedToolName, "list_courses", {
          structuredContent: {
            courses: [{ id: "canvas-course:1", name: "Algorithms", code: "CS101", canvasId: "1" }],
          },
        })
      }

      if (exposedToolName === "canvas.get_my_upcoming_assignments") {
        return createSuccess(exposedToolName, "get_my_upcoming_assignments", {
          structuredContent: {
            items: [
              {
                id: "canvas-coursework:assignment:1:101",
                courseId: "canvas-course:1",
                title: "Problem Set 1",
                effectiveDueAt: "2026-04-20T23:59:00.000Z",
                sourceType: "assignment",
                sourceId: "101",
                freshnessStatus: "fresh",
                htmlUrl: "https://canvas.example.edu/courses/1/assignments/101",
                pointsPossible: 10,
                submissionStatus: "not_submitted",
              },
            ],
          },
        })
      }

      if (exposedToolName === "canvas.get_my_submission_status") {
        return createSuccess(exposedToolName, "get_my_submission_status", {
          structuredContent: {
            submitted: [],
            pending: [
              {
                id: "canvas-coursework:assignment:1:101",
                courseId: "canvas-course:1",
                title: "Problem Set 1",
                effectiveDueAt: "2026-04-20T23:59:00.000Z",
                sourceType: "assignment",
                sourceId: "101",
                freshnessStatus: "fresh",
                htmlUrl: "https://canvas.example.edu/courses/1/assignments/101",
                pointsPossible: 10,
                submissionStatus: "not_submitted",
              },
            ],
            overdue: [],
          },
        })
      }

      if (exposedToolName === "canvas.get_my_course_grades") {
        return createSuccess(exposedToolName, "get_my_course_grades", {
          structuredContent: { courses: [] },
        })
      }

      if (exposedToolName === "canvas.get_my_todo_items") {
        return createSuccess(exposedToolName, "get_my_todo_items", {
          structuredContent: { items: [] },
        })
      }

      if (exposedToolName === "canvas.get_my_peer_reviews_todo") {
        return createSuccess(exposedToolName, "get_my_peer_reviews_todo", {
          structuredContent: { items: [] },
        })
      }

      throw new Error(`Unexpected tool call: ${exposedToolName}`)
    })

    const service = createSyncService(gatewayStubAsApiClient(gateway), pushBus, database, createEmptyMemoryPaths())

    await service.sync()
    expect(service.getMySubmissionStatus().pending).toEqual([
      expect.objectContaining({ id: "canvas-coursework:assignment:1:101" }),
    ])

    const archived = service.archiveAssignment("canvas-coursework:assignment:1:101" as any)
    expect(archived.archived).toBe(true)
    expect(String(archived.assignmentId)).toBe("canvas-coursework:assignment:1:101")
    expect(service.getMySubmissionStatus().pending).toEqual([])

    await service.sync()

    expect(service.getMyUpcomingAssignments()).toEqual([])
    expect(service.getMySubmissionStatus()).toEqual({
      submitted: [],
      pending: [],
      overdue: [],
    })

    database.close()
  })

  test("sync soft-fails optional student surfaces and still completes", async () => {
    const db = new BunDatabase(":memory:")
    runBunMigrations(db)

    const database = createDatabaseService(db)
    const { pushBus, events } = createPushBusStub()

    const gateway = createGatewayStub(async (exposedToolName) => {
      if (exposedToolName === "canvas.list_courses") {
        return createSuccess(exposedToolName, "list_courses", {
          structuredContent: {
            courses: [{ id: "canvas-course:1", name: "Algorithms", code: "CS101" }],
          },
        })
      }

      if (exposedToolName === "canvas.get_my_upcoming_assignments") {
        return createSuccess(exposedToolName, "get_my_upcoming_assignments", {
          structuredContent: { items: [] },
        })
      }

      if (exposedToolName === "canvas.get_my_submission_status") {
        return createSuccess(exposedToolName, "get_my_submission_status", {
          structuredContent: { submitted: [], pending: [], overdue: [] },
        })
      }

      if (exposedToolName === "canvas.get_my_course_grades") {
        return createSuccess(exposedToolName, "get_my_course_grades", {
          structuredContent: { courses: [] },
        })
      }

      if (exposedToolName === "canvas.get_my_todo_items") {
        return createSuccess(exposedToolName, "get_my_todo_items", {
          isError: true,
          content: [{ type: "text", text: "Todo items unavailable." }],
        })
      }

      if (exposedToolName === "canvas.get_my_peer_reviews_todo") {
        return createSuccess(exposedToolName, "get_my_peer_reviews_todo", {
          isError: true,
          content: [{ type: "text", text: "Peer review todo unavailable." }],
        })
      }

      throw new Error(`Unexpected tool call: ${exposedToolName}`)
    })

    const service = createSyncService(gatewayStubAsApiClient(gateway), pushBus, database, createEmptyMemoryPaths())

    await service.sync()

    expect(service.listCourses()).toHaveLength(1)
    expect(service.getMyTodoItems()).toEqual([])
    expect(service.getMyPeerReviewsTodo()).toEqual([])
    expect(events.at(-1)).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        status: "done",
        progress: 100,
      }),
    }))

    database.close()
  })

  test("passes through assignment detail lookups to the updated Canvas MCP surface", async () => {
    const db = new BunDatabase(":memory:")
    runBunMigrations(db)
    const database = createDatabaseService(db)
    const { pushBus } = createPushBusStub()

    const gateway = createGatewayStub(async (exposedToolName, args) => {
      expect(exposedToolName).toBe("canvas.get_assignment_details")
      expect(args).toEqual({
        assignmentUrl: "https://canvas.example.edu/courses/1/assignments/101",
      })
      return createSuccess(exposedToolName, "get_assignment_details", {
        structuredContent: {
          course: {
            id: "canvas-course:1" as any,
            name: "Algorithms",
            code: "CS101",
          },
          item: {
            id: "canvas-coursework:assignment:1:101" as any,
            courseId: "canvas-course:1" as any,
            title: "Problem Set 1",
            effectiveDueAt: "2026-04-20T23:59:00.000Z",
            sourceType: "assignment",
            sourceId: "101",
            freshnessStatus: "fresh",
          },
          source: {
            id: 101,
            course_id: 1,
            name: "Problem Set 1",
            due_at: "2026-04-20T23:59:00.000Z",
            points_possible: 10,
            submission_types: ["online_upload"],
            published: true,
          },
        } satisfies CanvasAssignmentDetailsResult,
      })
    })

    const service = createSyncService(gatewayStubAsApiClient(gateway), pushBus, database, createEmptyMemoryPaths())
    const detail = await service.getAssignmentDetails({
      assignmentUrl: "https://canvas.example.edu/courses/1/assignments/101",
    })

    expect(detail.item.title).toBe("Problem Set 1")
    database.close()
  })

  test("syncs remembered Canvas page assignment sources into coursework", async () => {
    const db = new BunDatabase(":memory:")
    runBunMigrations(db)

    const database = createDatabaseService(db)
    const { pushBus } = createPushBusStub()
    const memoryPaths = createEmptyMemoryPaths()
    mkdirSync(memoryPaths.courseDir("mythology"), { recursive: true })
    writeFileSync(
      memoryPaths.courseIndex("mythology"),
      [
        "---",
        "slug: mythology",
        "canvasId: 19737",
        "---",
        "",
        "# Mythology",
        "",
        "## Assignment Source Rules",
        "",
        "```json",
        JSON.stringify({
          id: "assignment-source:mythology-wiki",
          kind: "canvas_page",
          canvasCourseId: "19737",
          url: "https://ivc-new.instructure.com/courses/19737/wiki",
          purpose: "reading_homework_schedule",
          parser: "dated_reading_schedule",
          enabled: true,
        }, null, 2),
        "```",
      ].join("\n"),
      "utf-8",
    )

    const gateway = createGatewayStub(async (exposedToolName) => {
      if (exposedToolName === "canvas.list_courses") {
        return createSuccess(exposedToolName, "list_courses", {
          structuredContent: {
            courses: [
              {
                id: "canvas-course:19737",
                name: "Mythology",
                code: "MYTH",
                canvasId: "19737",
                term: "Spring 2026",
              },
            ],
          },
        })
      }

      if (exposedToolName === "canvas.get_my_upcoming_assignments") {
        return createSuccess(exposedToolName, "get_my_upcoming_assignments", {
          structuredContent: { items: [] },
        })
      }

      if (exposedToolName === "canvas.get_my_submission_status") {
        return createSuccess(exposedToolName, "get_my_submission_status", {
          structuredContent: { submitted: [], pending: [], overdue: [] },
        })
      }

      if (exposedToolName === "canvas.get_my_course_grades") {
        return createSuccess(exposedToolName, "get_my_course_grades", {
          structuredContent: { courses: [] },
        })
      }

      if (exposedToolName === "canvas.get_my_todo_items") {
        return createSuccess(exposedToolName, "get_my_todo_items", {
          structuredContent: { items: [] },
        })
      }

      if (exposedToolName === "canvas.get_my_peer_reviews_todo") {
        return createSuccess(exposedToolName, "get_my_peer_reviews_todo", {
          structuredContent: { items: [] },
        })
      }

      if (exposedToolName === "canvas.get_front_page") {
        return createSuccess(exposedToolName, "get_front_page", {
          structuredContent: {
            course: {
              id: "canvas-course:19737",
              name: "Mythology",
              code: "MYTH",
              canvasId: "19737",
              term: "Spring 2026",
            },
            page: {
              page_id: 900,
              url: "wiki",
              title: "Home",
              body: [
                "Week 1: January 12-18",
                "Wednesday, Jan. 14",
                "Read: Chapter 1: What is Myth?",
                "Read: Chapter 2: Ways of Understanding Myth",
                "Week 6: February 16-22",
                "Wednesday, Feb. 18",
                "Quiz 1 Myths of Creation and Destruction",
                "No Books, No Devices, No Screens",
              ].join("\n"),
              html_url: "https://ivc-new.instructure.com/courses/19737/wiki",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          },
        })
      }

      throw new Error(`Unexpected tool call: ${exposedToolName}`)
    })

    const service = createSyncService(gatewayStubAsApiClient(gateway), pushBus, database, memoryPaths)

    await service.sync()

    const assignments = service.getMySubmissionStatus()
    expect(assignments.overdue).toEqual([
      expect.objectContaining({
        title: "Read: Chapter 1: What is Myth?",
        sourceType: "page",
        sourceDueDateKind: "inferred",
      }),
      expect.objectContaining({
        title: "Read: Chapter 2: Ways of Understanding Myth",
        sourceType: "page",
      }),
      expect.objectContaining({
        title: "Quiz 1 Myths of Creation and Destruction",
        sourceType: "page",
      }),
    ])
    expect(database.query("SELECT last_error FROM course_assignment_sources")).toEqual([
      { last_error: null },
    ])

    const archivedId = assignments.overdue[0]?.id
    expect(archivedId).toBeDefined()
    service.archiveAssignment(archivedId!)
    expect(service.getMySubmissionStatus().overdue.map((item) => item.id)).not.toContain(archivedId)

    await service.sync()

    expect(service.getMySubmissionStatus().overdue.map((item) => item.id)).not.toContain(archivedId)

    database.close()
  })

  test("creates a durable course memory node for synced Canvas courses", async () => {
    const db = new BunDatabase(":memory:")
    runBunMigrations(db)

    const database = createDatabaseService(db)
    const { pushBus } = createPushBusStub()
    const memoryPaths = createEmptyMemoryPaths()

    const gateway = createGatewayStub(async (exposedToolName) => {
      if (exposedToolName === "canvas.list_courses") {
        return createSuccess(exposedToolName, "list_courses", {
          structuredContent: {
            courses: [
              {
                id: "canvas-course:19737",
                name: "Mythology",
                code: "MYTH",
                canvasId: "19737",
                term: "Spring 2026",
              },
            ],
          },
        })
      }
      if (exposedToolName === "canvas.get_my_upcoming_assignments") {
        return createSuccess(exposedToolName, "get_my_upcoming_assignments", {
          structuredContent: { items: [] },
        })
      }
      if (exposedToolName === "canvas.get_my_submission_status") {
        return createSuccess(exposedToolName, "get_my_submission_status", {
          structuredContent: { submitted: [], pending: [], overdue: [] },
        })
      }
      if (exposedToolName === "canvas.get_my_course_grades") {
        return createSuccess(exposedToolName, "get_my_course_grades", {
          structuredContent: { courses: [] },
        })
      }
      if (exposedToolName === "canvas.get_my_todo_items") {
        return createSuccess(exposedToolName, "get_my_todo_items", {
          structuredContent: { items: [] },
        })
      }
      if (exposedToolName === "canvas.get_my_peer_reviews_todo") {
        return createSuccess(exposedToolName, "get_my_peer_reviews_todo", {
          structuredContent: { items: [] },
        })
      }
      throw new Error(`Unexpected tool call: ${exposedToolName}`)
    })

    const service = createSyncService(gatewayStubAsApiClient(gateway), pushBus, database, memoryPaths)
    await service.sync()

    const nodePath = memoryPaths.courseIndex("myth")
    expect(existsSync(nodePath)).toBe(true)
    const content = readFileSync(nodePath, "utf-8")
    expect(content).toContain("canvasId: 19737")
    expect(content).toContain('canvasName: "Mythology"')
    expect(content).toContain("## Assignment Source Discovery")

    database.close()
  })

  test("uses bare Canvas course URL discovery hints to infer coursework from the front page", async () => {
    const db = new BunDatabase(":memory:")
    runBunMigrations(db)

    const database = createDatabaseService(db)
    const { pushBus } = createPushBusStub()
    const memoryPaths = createEmptyMemoryPaths()
    mkdirSync(memoryPaths.courseDir("mythology"), { recursive: true })
    writeFileSync(
      memoryPaths.courseIndex("mythology"),
      [
        "---",
        "slug: mythology",
        "canvasId: 19737",
        "---",
        "",
        "# Mythology",
        "",
        "## Assignment Source Discovery",
        "",
        "```json",
        JSON.stringify({
          kind: "canvas_assignment_source_hint",
          canvasCourseId: "19737",
          url: "https://ivc-new.instructure.com/courses/19737",
          possibleContent: ["weekly readings"],
          parser: "dated_reading_schedule",
          status: "candidate",
        }, null, 2),
        "```",
      ].join("\n"),
      "utf-8",
    )

    const gateway = createGatewayStub(async (exposedToolName) => {
      if (exposedToolName === "canvas.list_courses") {
        return createSuccess(exposedToolName, "list_courses", {
          structuredContent: {
            courses: [
              {
                id: "canvas-course:19737",
                name: "Mythology",
                code: "MYTH",
                canvasId: "19737",
                term: "Spring 2026",
              },
            ],
          },
        })
      }
      if (exposedToolName === "canvas.get_my_upcoming_assignments") {
        return createSuccess(exposedToolName, "get_my_upcoming_assignments", {
          structuredContent: { items: [] },
        })
      }
      if (exposedToolName === "canvas.get_my_submission_status") {
        return createSuccess(exposedToolName, "get_my_submission_status", {
          structuredContent: { submitted: [], pending: [], overdue: [] },
        })
      }
      if (exposedToolName === "canvas.get_my_course_grades") {
        return createSuccess(exposedToolName, "get_my_course_grades", {
          structuredContent: { courses: [] },
        })
      }
      if (exposedToolName === "canvas.get_my_todo_items") {
        return createSuccess(exposedToolName, "get_my_todo_items", {
          structuredContent: { items: [] },
        })
      }
      if (exposedToolName === "canvas.get_my_peer_reviews_todo") {
        return createSuccess(exposedToolName, "get_my_peer_reviews_todo", {
          structuredContent: { items: [] },
        })
      }
      if (exposedToolName === "canvas.get_front_page") {
        return createSuccess(exposedToolName, "get_front_page", {
          structuredContent: {
            course: {
              id: "canvas-course:19737",
              name: "Mythology",
              code: "MYTH",
              canvasId: "19737",
              term: "Spring 2026",
            },
            page: {
              page_id: 900,
              url: "wiki",
              title: "Home",
              body: [
                "Week 1: January 12-18",
                "Wednesday, Jan. 14",
                "Read: Chapter 1: What is Myth?",
              ].join("\n"),
              html_url: "https://ivc-new.instructure.com/courses/19737",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          },
        })
      }
      throw new Error(`Unexpected tool call: ${exposedToolName}`)
    })

    const service = createSyncService(gatewayStubAsApiClient(gateway), pushBus, database, memoryPaths)
    await service.sync()

    expect(service.getMySubmissionStatus().overdue).toEqual([
      expect.objectContaining({
        title: "Read: Chapter 1: What is Myth?",
        sourceType: "page",
        sourceDueDateKind: "inferred",
      }),
    ])
    expect(database.query("SELECT last_error FROM course_assignment_sources")).toEqual([
      { last_error: null },
    ])
    const courseMemory = readFileSync(memoryPaths.courseIndex("mythology"), "utf-8")
    expect(courseMemory).toContain("## Assignment Source Rules")
    expect(courseMemory).toContain('"url": "https://ivc-new.instructure.com/courses/19737"')
    expect(courseMemory).toContain('"enabled": true')

    database.close()
  })

  test("records last_error when a discovery hint is not parseable", async () => {
    const db = new BunDatabase(":memory:")
    runBunMigrations(db)

    const database = createDatabaseService(db)
    const { pushBus } = createPushBusStub()
    const memoryPaths = createEmptyMemoryPaths()
    mkdirSync(memoryPaths.courseDir("mythology"), { recursive: true })
    writeFileSync(
      memoryPaths.courseIndex("mythology"),
      [
        "---",
        "slug: mythology",
        "canvasId: 19737",
        "---",
        "",
        "# Mythology",
        "",
        "## Assignment Source Discovery",
        "",
        "```json",
        JSON.stringify({
          kind: "canvas_assignment_source_hint",
          canvasCourseId: "19737",
          url: "https://ivc-new.instructure.com/courses/19737",
          possibleContent: ["weekly readings"],
          parser: "dated_reading_schedule",
          status: "candidate",
        }, null, 2),
        "```",
      ].join("\n"),
      "utf-8",
    )

    const gateway = createGatewayStub(async (exposedToolName) => {
      if (exposedToolName === "canvas.list_courses") {
        return createSuccess(exposedToolName, "list_courses", {
          structuredContent: {
            courses: [
              {
                id: "canvas-course:19737",
                name: "Mythology",
                code: "MYTH",
                canvasId: "19737",
                term: "Spring 2026",
              },
            ],
          },
        })
      }
      if (exposedToolName === "canvas.get_my_upcoming_assignments") {
        return createSuccess(exposedToolName, "get_my_upcoming_assignments", {
          structuredContent: { items: [] },
        })
      }
      if (exposedToolName === "canvas.get_my_submission_status") {
        return createSuccess(exposedToolName, "get_my_submission_status", {
          structuredContent: { submitted: [], pending: [], overdue: [] },
        })
      }
      if (exposedToolName === "canvas.get_my_course_grades") {
        return createSuccess(exposedToolName, "get_my_course_grades", {
          structuredContent: { courses: [] },
        })
      }
      if (exposedToolName === "canvas.get_my_todo_items") {
        return createSuccess(exposedToolName, "get_my_todo_items", {
          structuredContent: { items: [] },
        })
      }
      if (exposedToolName === "canvas.get_my_peer_reviews_todo") {
        return createSuccess(exposedToolName, "get_my_peer_reviews_todo", {
          structuredContent: { items: [] },
        })
      }
      if (exposedToolName === "canvas.get_front_page") {
        return createSuccess(exposedToolName, "get_front_page", {
          structuredContent: {
            course: {
              id: "canvas-course:19737",
              name: "Mythology",
              code: "MYTH",
              canvasId: "19737",
              term: "Spring 2026",
            },
            page: {
              page_id: 900,
              url: "wiki",
              title: "Home",
              body: "Welcome to Mythology.",
              html_url: "https://ivc-new.instructure.com/courses/19737",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          },
        })
      }
      throw new Error(`Unexpected tool call: ${exposedToolName}`)
    })

    const service = createSyncService(gatewayStubAsApiClient(gateway), pushBus, database, memoryPaths)
    await service.sync()

    expect(service.getMySubmissionStatus().pending).toEqual([])
    expect(database.query("SELECT last_error FROM course_assignment_sources")).toEqual([
      { last_error: "No coursework items found in remembered source." },
    ])

    database.close()
  })

  test("flushes memory promotion before projecting remembered assignment sources", async () => {
    const db = new BunDatabase(":memory:")
    runBunMigrations(db)

    const database = createDatabaseService(db)
    const { pushBus } = createPushBusStub()
    const memoryPaths = createEmptyMemoryPaths()
    const toolCalls: string[] = []

    const gateway = createGatewayStub(async (exposedToolName) => {
      toolCalls.push(exposedToolName)

      if (exposedToolName === "canvas.list_courses") {
        return createSuccess(exposedToolName, "list_courses", {
          structuredContent: {
            courses: [
              {
                id: "canvas-course:19737",
                name: "Mythology",
                code: "MYTH",
                canvasId: "19737",
                term: "Spring 2026",
              },
            ],
          },
        })
      }

      if (exposedToolName === "canvas.get_my_upcoming_assignments") {
        return createSuccess(exposedToolName, "get_my_upcoming_assignments", {
          structuredContent: { items: [] },
        })
      }

      if (exposedToolName === "canvas.get_my_submission_status") {
        return createSuccess(exposedToolName, "get_my_submission_status", {
          structuredContent: { submitted: [], pending: [], overdue: [] },
        })
      }

      if (exposedToolName === "canvas.get_my_course_grades") {
        return createSuccess(exposedToolName, "get_my_course_grades", {
          structuredContent: { courses: [] },
        })
      }

      if (exposedToolName === "canvas.get_my_todo_items") {
        return createSuccess(exposedToolName, "get_my_todo_items", {
          structuredContent: { items: [] },
        })
      }

      if (exposedToolName === "canvas.get_my_peer_reviews_todo") {
        return createSuccess(exposedToolName, "get_my_peer_reviews_todo", {
          structuredContent: { items: [] },
        })
      }

      if (exposedToolName === "canvas.get_front_page") {
        return createSuccess(exposedToolName, "get_front_page", {
          structuredContent: {
            course: {
              id: "canvas-course:19737",
              name: "Mythology",
              code: "MYTH",
              canvasId: "19737",
              term: "Spring 2026",
            },
            page: {
              page_id: 900,
              url: "wiki",
              title: "Home",
              body: [
                "Week 1: January 12-18",
                "Wednesday, Jan. 14",
                "Read: Chapter 1: What is Myth?",
              ].join("\n"),
              html_url: "https://ivc-new.instructure.com/courses/19737/wiki",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          },
        })
      }

      throw new Error(`Unexpected tool call: ${exposedToolName}`)
    })

    const flushPromotion = async () => {
      toolCalls.push("memory.promote")
      mkdirSync(memoryPaths.courseDir("mythology"), { recursive: true })
      writeFileSync(
        memoryPaths.courseIndex("mythology"),
        [
          "---",
          "slug: mythology",
          "canvasId: 19737",
          "---",
          "",
          "# Mythology",
          "",
          "## Assignment Source Rules",
          "",
          "```json",
          JSON.stringify({
            kind: "canvas_page",
            canvasCourseId: "19737",
            url: "https://ivc-new.instructure.com/courses/19737/wiki",
            purpose: "reading_homework_schedule",
            parser: "dated_reading_schedule",
            enabled: true,
          }, null, 2),
          "```",
        ].join("\n"),
        "utf-8",
      )
    }

    const service = createSyncService(gatewayStubAsApiClient(gateway), pushBus, database, memoryPaths, flushPromotion)

    await service.sync()

    expect(toolCalls.indexOf("memory.promote")).toBeGreaterThan(-1)
    expect(toolCalls.indexOf("canvas.get_front_page")).toBeGreaterThan(toolCalls.indexOf("memory.promote"))
    expect(service.getMySubmissionStatus().overdue).toEqual([
      expect.objectContaining({
        title: "Read: Chapter 1: What is Myth?",
        sourceType: "page",
        sourceDueDateKind: "inferred",
      }),
    ])

    database.close()
  })
})
