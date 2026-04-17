import { describe, expect, test } from "bun:test"
import { Database as BunDatabase } from "bun:sqlite"
import type { GatewayToolCallResult } from "@student-claw/contracts"
import type { PluginGatewayService } from "../mcp/PluginGateway.js"
import type { PushBusService } from "../ws/PushBus.js"
import type { DatabaseService } from "../db/Database.js"
import { runMigrations } from "../db/migrations/runner.js"
import { createSyncService } from "../canvas/CanvasSyncService.js"

function createDatabaseService(db: BunDatabase): DatabaseService {
  return {
    db,
    get: <T>(sql: string, params: unknown[] = []) => (db.query(sql).get(...params) as T | null) ?? null,
    query: <T>(sql: string, params: unknown[] = []) => db.query(sql).all(...params) as T[],
    execute: (sql: string, params: unknown[] = []) => {
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
  test("syncs courses, coursework, and grades when Canvas tools return structured content", async () => {
    const db = new BunDatabase(":memory:")
    runMigrations(db)

    const database = createDatabaseService(db)
    const { pushBus, events } = createPushBusStub()
    const toolCalls: string[] = []

    const gateway = createGatewayStub(async (exposedToolName, args) => {
      toolCalls.push(exposedToolName)

      if (exposedToolName === "canvas.get_courses") {
        return createSuccess(exposedToolName, "get_courses", {
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

      if (exposedToolName === "canvas.get_coursework") {
        expect(args).toEqual({
          sources: ["assignment", "module", "page", "announcement"],
          includeCompleted: true,
        })

        return createSuccess(exposedToolName, "get_coursework", {
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
                submissionStatus: "submitted",
                grade: "9",
              },
            ],
          },
        })
      }

      if (exposedToolName === "canvas.get_grades") {
        expect(args).toEqual({ courseId: "canvas-course:1" })
        return createSuccess(exposedToolName, "get_grades", {
          structuredContent: {
            grades: [
              {
                courseId: "canvas-course:1",
                assignmentId: "101",
                score: 9,
                maxScore: 10,
                letterGrade: "A-",
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
      "canvas.get_courses",
      "canvas.get_coursework",
      "canvas.get_grades",
    ])
    expect(service.getCourses()).toHaveLength(1)
    expect(service.getCoursework()).toEqual([
      expect.objectContaining({
        id: "canvas-coursework:assignment:1:101",
        courseId: "canvas-course:1",
        title: "Problem Set 1",
        htmlUrl: "https://canvas.example.edu/courses/1/assignments/101",
      }),
    ])
    expect(service.getGrades()).toEqual([
      expect.objectContaining({
        courseId: "canvas-course:1",
        assignmentId: "101",
        score: 9,
        maxScore: 10,
        letterGrade: "A-",
      }),
    ])
    expect(events.at(-1)).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        status: "done",
        progress: 100,
      }),
    }))

    database.close()
  })

  test("publishes an error and stops when a Canvas tool returns an MCP tool error", async () => {
    const db = new BunDatabase(":memory:")
    runMigrations(db)

    const database = createDatabaseService(db)
    const { pushBus, events } = createPushBusStub()
    const toolCalls: string[] = []

    const gateway = createGatewayStub(async (exposedToolName) => {
      toolCalls.push(exposedToolName)

      if (exposedToolName === "canvas.get_courses") {
        return createSuccess(exposedToolName, "get_courses", {
          structuredContent: {
            courses: [
              {
                id: "canvas-course:1",
                name: "Algorithms",
                code: "CS101",
              },
            ],
          },
        })
      }

      if (exposedToolName === "canvas.get_coursework") {
        return createSuccess(exposedToolName, "get_coursework", {
          isError: true,
          content: [
            {
              type: "text",
              text: "Canvas credentials have not been provided to the plugin runtime yet.",
            },
          ],
        })
      }

      throw new Error(`Unexpected tool call: ${exposedToolName}`)
    })

    const service = createSyncService(gateway, pushBus, database)

    await service.sync()

    expect(toolCalls).toEqual([
      "canvas.get_courses",
      "canvas.get_coursework",
    ])
    expect(service.getCourses()).toHaveLength(1)
    expect(service.getCoursework()).toHaveLength(0)
    expect(service.getGrades()).toHaveLength(0)
    expect(events.some((event) => {
      return typeof event.data === "object"
        && event.data !== null
        && "status" in event.data
        && event.data.status === "done"
    })).toBe(false)
    expect(events.at(-1)).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        status: "error",
        progress: 0,
      }),
    }))

    database.close()
  })
})
