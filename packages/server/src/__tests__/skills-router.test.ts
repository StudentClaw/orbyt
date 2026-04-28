import { describe, test, expect, afterEach } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { RPC_METHODS, type ThreadId, type TurnId } from "@orbyt/contracts"
import { routeMessage } from "../ws/Router.js"
import { defaultConfig } from "../config/defaults.js"
import {
  createSkillManagementService,
  createFileSkillGrantStore,
} from "../skills/index.js"
import { createBunDatabaseService, createBunTestDatabase, runBunMigrations } from "./db-test-helpers.js"

const mockWs = { readyState: 1, send: () => undefined } as never

const tempDirs: string[] = []

function mkTmp(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-skills-router-"))
  tempDirs.push(dir)
  return dir
}

function writeCurated(root: string, slug: string): void {
  mkdirSync(path.join(root, slug), { recursive: true })
  const content = [
    "---",
    `name: ${slug}`,
    `description: curated ${slug}`,
    "version: 1.0.0",
    "tier: curated",
    "requested_capabilities:",
    "  - canvas.shared.read",
    "  - calendar.events.write",
    "---",
    "",
    "# body",
    "",
  ].join("\n")
  writeFileSync(path.join(root, slug, "SKILL.md"), content, "utf8")
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function makeDeps() {
  const threadId = "thread_1" as ThreadId
  const turnId = "turn_1" as TurnId
  const db = createBunTestDatabase(":memory:")
  runBunMigrations(db)

  const workspace = mkTmp()
  const curatedRoot = path.join(workspace, "repo-skills")
  const userRoot = path.join(workspace, "user-skills")
  mkdirSync(userRoot, { recursive: true })
  writeCurated(curatedRoot, "plan-mode")
  const grantStore = createFileSkillGrantStore(path.join(workspace, "grants.json"))
  const skillManagement = createSkillManagementService({
    userSkillsDir: userRoot,
    curatedRoots: [curatedRoot],
    grantStore,
  })

  return {
    dependencies: {
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
        getDesktopBootstrap: async () => ({ wsUrl: "ws://127.0.0.1:8787", wsAuthToken: "a".repeat(64), appVersion: "0.1.0", platform: "test", featureFlags: { pluginSystem: false } }),
        getServerConfig: async () => ({} as any),
        getSnapshot: async () => ({} as any),
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
        getAssignmentDetails: async () => { throw new Error("n/a") },
        listAssignments: async () => ({ course: undefined, items: [], courses: undefined }),
        archiveAssignment: (assignmentId: any) => ({ archived: true as const, assignmentId }),
        unarchiveAssignment: (assignmentId: any) => ({ unarchived: true as const, assignmentId }),
        getCourseContentOverview: async () => ({ course: undefined, pageCount: 0, moduleCount: 0, moduleItemCount: 0, frontPage: undefined, courses: undefined }),
        getCourseStructure: async () => ({ course: undefined, modules: [], courses: undefined }),
        downloadCourseFile: async () => ({ success: true, courseId: "course_1" as any, fileId: "file_1", filename: "file.txt", savedPath: "/tmp/file.txt", overwritten: false, message: "downloaded" }),
      },
      skillResolver: {
        resolve: () => null,
        listAll: () => [],
      },
      skillManagement,
      memorize: { runIfNeeded: async () => ({ ran: false, result: null }) },
    },
    fixtures: { userRoot, curatedRoot, grantStore, skillManagement },
  }
}

describe("Router - Phase 04 skills management", () => {
  test("skills.list returns tier/version/requestedCapabilities and missingCapabilities per skill", async () => {
    const { dependencies } = makeDeps()
    const res = JSON.parse(
      (await routeMessage(
        JSON.stringify({ kind: "request", method: RPC_METHODS.SKILLS_LIST, id: "1", params: {} }),
        mockWs,
        dependencies as any,
      )).response,
    )
    expect(res.ok).toBe(true)
    const plan = res.result.skills.find((s: any) => s.id === "plan-mode")
    expect(plan).toBeDefined()
    expect(plan.tier).toBe("curated")
    expect(plan.requestedCapabilities).toContain("calendar.events.write")
    expect(plan.missingCapabilities).toContain("calendar.events.write")
    expect(plan.editable).toBe(false)
  })

  test("skills.fork copies curated skill into user dir and the next list call reflects the custom fork", async () => {
    const { dependencies, fixtures } = makeDeps()

    const forkRes = JSON.parse(
      (await routeMessage(
        JSON.stringify({
          kind: "request",
          method: RPC_METHODS.SKILLS_FORK,
          id: "2",
          params: { sourceSlug: "plan-mode", targetSlug: "my-plan" },
        }),
        mockWs,
        dependencies as any,
      )).response,
    )
    expect(forkRes.ok).toBe(true)
    expect(forkRes.result.skill.id).toBe("my-plan")
    expect(forkRes.result.skill.tier).toBe("custom")
    expect(forkRes.result.skill.forkedFrom).toBe("plan-mode@1.0.0")

    expect(existsSync(path.join(fixtures.userRoot, "my-plan", "SKILL.md"))).toBe(true)
  })

  test("skills.grantCapability + skills.revokeCapability mutate the persistent grant store", async () => {
    const { dependencies, fixtures } = makeDeps()

    const grant = JSON.parse(
      (await routeMessage(
        JSON.stringify({
          kind: "request",
          method: RPC_METHODS.SKILLS_GRANT_CAPABILITY,
          id: "3",
          params: { skillId: "plan-mode", capabilityKey: "calendar.events.write" },
        }),
        mockWs,
        dependencies as any,
      )).response,
    )
    expect(grant.ok).toBe(true)
    expect(grant.result.grantedCapabilities).toContain("calendar.events.write")
    expect(fixtures.grantStore.get("plan-mode" as any)).toContain("calendar.events.write")

    const revoke = JSON.parse(
      (await routeMessage(
        JSON.stringify({
          kind: "request",
          method: RPC_METHODS.SKILLS_REVOKE_CAPABILITY,
          id: "4",
          params: { skillId: "plan-mode", capabilityKey: "calendar.events.write" },
        }),
        mockWs,
        dependencies as any,
      )).response,
    )
    expect(revoke.ok).toBe(true)
    expect(revoke.result.grantedCapabilities).not.toContain("calendar.events.write")
  })

  test("skills.grantCapability rejects an unknown capability key with a structured error", async () => {
    const { dependencies } = makeDeps()
    const res = JSON.parse(
      (await routeMessage(
        JSON.stringify({
          kind: "request",
          method: RPC_METHODS.SKILLS_GRANT_CAPABILITY,
          id: "5",
          params: { skillId: "plan-mode", capabilityKey: "evil.inject" },
        }),
        mockWs,
        dependencies as any,
      )).response,
    )
    expect(res.ok).toBe(false)
    expect(String(res.error?.message || "")).toMatch(/unknown capability/i)
  })
})
