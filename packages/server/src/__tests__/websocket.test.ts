import { describe, test, expect } from "bun:test"
import { RPC_METHODS, type ThreadId, type TurnId } from "@student-claw/contracts"
import { routeMessage } from "../ws/Router.js"
import { defaultConfig } from "../config/defaults.js"
import { createBunDatabaseService, createBunTestDatabase, runBunMigrations } from "./db-test-helpers.js"

const mockWs = { readyState: 1, send: () => undefined } as never

function makeDependencies() {
  const threadId = "thread_1" as ThreadId
  const turnId = "turn_1" as TurnId
  const db = createBunTestDatabase(":memory:")
  runBunMigrations(db)
  return {
    config: {
      ...defaultConfig,
      wsAuthToken: "a".repeat(64),
      codexBinaryPath: "/usr/bin/false",
    },
    readiness: {
      awaitReady: async () => undefined,
      markReady: () => undefined,
      isReady: () => true,
    },
    pushBus: {
      registerClient: () => undefined,
      removeClient: () => undefined,
      subscribe: () => undefined,
      publish: async () => 1,
      publishTo: async () => 1,
      getLastSequence: () => 1,
    },
    orchestration: {
      getDesktopBootstrap: async () => ({
        wsUrl: "ws://127.0.0.1:8787",
        wsAuthToken: "a".repeat(64),
        appVersion: "0.1.0",
        platform: "test",
        featureFlags: {
          pluginSystem: false,
        },
      }),
      getServerConfig: async () => ({
        appVersion: "0.1.0",
        platform: "test",
        protocolVersion: "rpc-v1",
        capabilities: {
          orchestration: true,
          providerRuntime: true,
          desktopBootstrap: true,
        },
        defaultChatModel: "gpt-5.4-mini",
        chatModels: [
          {
            id: "gpt-5.4-mini",
            label: "GPT-5.4 Mini",
            description: "Fast default model",
            group: "standard" as const,
          },
        ],
        featureFlags: {
          pluginSystem: false,
        },
      }),
      getSnapshot: async () => ({
        workspaces: [],
        threads: [],
        turns: [],
        pendingApprovals: [],
        providerStatus: "idle" as const,
        providerRuntime: {
          adapter: "codex" as const,
          status: "idle" as const,
          authState: "authenticated" as const,
          lastError: null,
          queuedTurnCount: 0,
          lastUpdatedAt: "2026-04-09T12:00:00.000Z",
        },
        ready: true,
        lastSequence: 1,
      }),
      createWorkspace: async () => ({ workspaceId: "workspace_1" as never }),
      relinkWorkspace: async () => ({ workspaceId: "workspace_1" as never }),
      deleteWorkspace: async () => ({ deleted: true }),
      createThread: async () => ({ threadId }),
      renameThread: async () => ({ threadId }),
      deleteThread: async () => ({ deleted: true }),
      setThreadAccessMode: async () => ({ threadId, accessMode: "default" as const }),
      sendTurn: async () => ({ turnId }),
      interruptTurn: async () => ({ interrupted: true }),
      startProviderAuth: async () => ({ started: true }),
      retryProviderInitialize: async () => ({ started: true }),
      respondToProviderApproval: async () => ({ approvalRequestId: "approval_1", resolved: true }),
      shutdown: async () => undefined,
    },
    database: createBunDatabaseService(db),
    canvasSync: {
      sync: async () => undefined,
      listCourses: () => [],
      getMyUpcomingAssignments: () => [],
      getMySubmissionStatus: () => ({ submitted: [], pending: [], overdue: [] }),
      getMyCourseGrades: () => [],
      getMyTodoItems: () => [],
      getMyPeerReviewsTodo: () => [],
      getAssignmentDetails: async () => {
        throw new Error("not implemented in websocket test")
      },
      listAssignments: async () => ({ course: undefined, items: [], courses: undefined }),
      getCourseContentOverview: async () => ({
        course: undefined,
        pageCount: 0,
        moduleCount: 0,
        moduleItemCount: 0,
        frontPage: undefined,
        courses: undefined,
      }),
            getCourseStructure: async () => ({ course: undefined, modules: [], courses: undefined }),
            downloadCourseFile: async () => ({
              success: true,
              courseId: "course_1" as any,
              fileId: "file_1",
              filename: "file.txt",
              savedPath: "/tmp/file.txt",
              overwritten: false,
              message: "downloaded",
            }),
          },
    skillResolver: {
      resolve: () => null,
      listAll: () => [],
    },
    memorize: {
      runIfNeeded: async () => ({ ran: false, result: null }),
    },
  }
}

describe("Router", () => {
  test("server.getBootstrap returns a success response", async () => {
    const response = JSON.parse(
      (await routeMessage(JSON.stringify({
        kind: "request",
        method: RPC_METHODS.SERVER_GET_BOOTSTRAP,
        id: "1",
        params: {},
      }), mockWs, makeDependencies())).response,
    )
    expect(response.kind).toBe("response")
    expect(response.ok).toBe(true)
    expect(response.result.wsUrl).toContain("127.0.0.1")
  })

  test("server.getConfig returns a success response", async () => {
    const response = JSON.parse(
      (await routeMessage(JSON.stringify({
        kind: "request",
        method: RPC_METHODS.SERVER_GET_CONFIG,
        id: "2",
        params: {},
      }), mockWs, makeDependencies())).response,
    )
    expect(response.kind).toBe("response")
    expect(response.ok).toBe(true)
    expect(response.result.protocolVersion).toBe("rpc-v1")
  })

  test("invalid JSON returns error response", async () => {
    const response = await routeMessage("not json", mockWs, makeDependencies())
    const parsed = JSON.parse(response.response)
    expect(response.close?.code).toBe(1007)
    expect(parsed.kind).toBe("response")
    expect(parsed.ok).toBe(false)
    expect(parsed.error.code).toBe("parse_error")
  })

  test("invalid request envelope returns error", async () => {
    const response = await routeMessage(
      JSON.stringify({ method: "unknown", id: "1", params: {} }),
      mockWs,
      makeDependencies(),
    )
    const parsed = JSON.parse(response.response)
    expect(response.close?.code).toBe(1007)
    expect(parsed.ok).toBe(false)
    expect(parsed.error.code).toBe("invalid_request")
  })

  test("unimplemented method returns not-found error", async () => {
    const response = JSON.parse(
      (await routeMessage(JSON.stringify({
        kind: "request",
        method: "unknown.method",
        id: "1",
        params: {},
      }), mockWs, makeDependencies())).response,
    )
    expect(response.kind).toBe("response")
    expect(response.ok).toBe(false)
    expect(response.error.code).toBe("method_not_found")
  })

  test("activity.generateWeeklyInsight returns a weekly insight payload", async () => {
    const deps = makeDependencies()
    deps.database.execute(
      `INSERT INTO activity_feed (id, category, type, title, body, priority, deep_link, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "activity_1",
        "workflow",
        "workflow_completed",
        "Workflow complete",
        "Task finished",
        3,
        "/chat",
        "2026-04-15T10:00:00.000Z",
      ],
    )

    const response = JSON.parse(
      (await routeMessage(JSON.stringify({
        kind: "request",
        method: RPC_METHODS.ACTIVITY_GENERATE_WEEKLY_INSIGHT,
        id: "weekly-1",
        params: {},
      }), mockWs, deps)).response,
    )

    expect(response.ok).toBe(true)
    expect(response.result.title).toContain("Weekly insight")
    expect(response.result.weekKey).toBe("2026-04-13")
  })
})
