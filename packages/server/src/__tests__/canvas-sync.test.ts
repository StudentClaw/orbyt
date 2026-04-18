import { describe, expect, test } from "bun:test"
import { Database as BunDatabase, type SQLQueryBindings } from "bun:sqlite"
import type {
  CanvasAssignmentDetailsResult,
  GatewayToolCallResult,
} from "@student-claw/contracts"
import type { PluginGatewayService } from "../mcp/PluginGateway.js"
import type { PushBusService } from "../ws/PushBus.js"
import type { DatabaseService } from "../db/Database.js"
import { runMigrations } from "../db/migrations/runner.js"
import { createSyncService } from "../canvas/CanvasSyncService.js"

function createDatabaseService(db: BunDatabase): DatabaseService {
  return {
    db,
    get: <T>(sql: string, params: SQLQueryBindings[] = []) => (db.query(sql).get(...params) as T | null) ?? null,
    query: <T>(sql: string, params: SQLQueryBindings[] = []) => db.query(sql).all(...params) as T[],
    execute: (sql: string, params: SQLQueryBindings[] = []) => {
      db.run(sql, params)
    },
    transaction: <T>(fn: () => T) => db.transaction(fn)(),
    close: () => db.close(),
  }
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

describe("CanvasSyncService", () => {
  test("syncs student-first Canvas state from the updated MCP tool surface", async () => {
    const db = new BunDatabase(":memory:")
    runMigrations(db)

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
            ],
          },
        })
      }

      throw new Error(`Unexpected tool call: ${exposedToolName}`)
    })

    const service = createSyncService(gateway, pushBus, database)

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

  test("sync soft-fails optional student surfaces and still completes", async () => {
    const db = new BunDatabase(":memory:")
    runMigrations(db)

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

    const service = createSyncService(gateway, pushBus, database)

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
    runMigrations(db)
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

    const service = createSyncService(gateway, pushBus, database)
    const detail = await service.getAssignmentDetails({
      assignmentUrl: "https://canvas.example.edu/courses/1/assignments/101",
    })

    expect(detail.item.title).toBe("Problem Set 1")
    database.close()
  })
})
