import { describe, test, expect } from "bun:test"
import { Schema } from "@effect/schema"
import {
  Extension as ContractsExtension,
  ExtensionManifest as ContractsExtensionManifest,
  ExtensionLifecycleStatus as ContractsExtensionLifecycleStatus,
} from "@student-claw/contracts"
import {
  CourseId, CourseWorkItemId, SkillId, TaskId, SessionId, ActivityEntryId,
  Course, CourseWorkItem, Grade, PlannedSession, ActivityFeedEntry,
  MemoryEntry, Extension, ExtensionManifest, ExtensionLifecycleStatus, StudentPreference, OnboardingState,
} from "../schemas/index.js"

describe("Branded IDs", () => {
  test("CourseId decodes valid string", () => {
    const decode = Schema.decodeUnknownSync(CourseId)
    expect(decode("course-1")).toBe("course-1")
  })

  test("CourseId rejects non-string", () => {
    const decode = Schema.decodeUnknownSync(CourseId)
    expect(() => decode(123)).toThrow()
  })

  test("CourseWorkItemId decodes valid string", () => {
    const decode = Schema.decodeUnknownSync(CourseWorkItemId)
    expect(decode("item-1")).toBe("item-1")
  })

  test("SkillId decodes valid string", () => {
    const decode = Schema.decodeUnknownSync(SkillId)
    expect(decode("skill-1")).toBe("skill-1")
  })

  test("TaskId decodes valid string", () => {
    const decode = Schema.decodeUnknownSync(TaskId)
    expect(decode("task-1")).toBe("task-1")
  })

  test("SessionId decodes valid string", () => {
    const decode = Schema.decodeUnknownSync(SessionId)
    expect(decode("session-1")).toBe("session-1")
  })

  test("ActivityEntryId decodes valid string", () => {
    const decode = Schema.decodeUnknownSync(ActivityEntryId)
    expect(decode("entry-1")).toBe("entry-1")
  })
})

describe("Course schema", () => {
  test("decodes valid course", () => {
    const decode = Schema.decodeUnknownSync(Course)
    const result = decode({
      id: "c-1",
      name: "Intro to CS",
      code: "CS101",
    })
    expect(result.name).toBe("Intro to CS")
    expect(result.code).toBe("CS101")
  })

  test("rejects missing required fields", () => {
    const decode = Schema.decodeUnknownSync(Course)
    expect(() => decode({ id: "c-1" })).toThrow()
  })

  test("accepts optional fields", () => {
    const decode = Schema.decodeUnknownSync(Course)
    const result = decode({
      id: "c-1",
      name: "Intro to CS",
      code: "CS101",
      professor: "Dr. Smith",
      term: "Fall 2026",
    })
    expect(result.professor).toBe("Dr. Smith")
  })
})

describe("CourseWorkItem schema", () => {
  test("decodes valid item", () => {
    const decode = Schema.decodeUnknownSync(CourseWorkItem)
    const result = decode({
      id: "cwi-1",
      courseId: "c-1",
      title: "Homework 1",
      sourceType: "assignment",
      freshnessStatus: "fresh",
    })
    expect(result.title).toBe("Homework 1")
    expect(result.sourceType).toBe("assignment")
  })

  test("rejects invalid sourceType", () => {
    const decode = Schema.decodeUnknownSync(CourseWorkItem)
    expect(() => decode({
      id: "cwi-1",
      courseId: "c-1",
      title: "HW",
      sourceType: "quiz",
      freshnessStatus: "fresh",
    })).toThrow()
  })
})

describe("Grade schema", () => {
  test("decodes valid grade", () => {
    const decode = Schema.decodeUnknownSync(Grade)
    const result = decode({
      courseId: "c-1",
      assignmentId: "a-1",
      score: 95,
      maxScore: 100,
    })
    expect(result.score).toBe(95)
  })
})

describe("PlannedSession schema", () => {
  test("decodes valid session", () => {
    const decode = Schema.decodeUnknownSync(PlannedSession)
    const result = decode({
      id: "s-1",
      taskId: "t-1",
      startTime: "2026-04-05T10:00:00Z",
      endTime: "2026-04-05T11:00:00Z",
      status: "scheduled",
    })
    expect(result.status).toBe("scheduled")
  })

  test("rejects invalid status", () => {
    const decode = Schema.decodeUnknownSync(PlannedSession)
    expect(() => decode({
      id: "s-1",
      taskId: "t-1",
      startTime: "2026-04-05T10:00:00Z",
      endTime: "2026-04-05T11:00:00Z",
      status: "invalid",
    })).toThrow()
  })
})

describe("ActivityFeedEntry schema", () => {
  test("decodes valid entry", () => {
    const decode = Schema.decodeUnknownSync(ActivityFeedEntry)
    const result = decode({
      id: "afe-1",
      category: "canvas",
      type: "sync",
      title: "New assignment",
    })
    expect(result.category).toBe("canvas")
  })

  test("rejects invalid category", () => {
    const decode = Schema.decodeUnknownSync(ActivityFeedEntry)
    expect(() => decode({
      id: "afe-1",
      category: "invalid",
      type: "sync",
      title: "New assignment",
    })).toThrow()
  })
})

describe("MemoryEntry schema", () => {
  test("decodes valid entry", () => {
    const decode = Schema.decodeUnknownSync(MemoryEntry)
    const result = decode({
      id: "m-1",
      content: "Student prefers morning study",
      scope: "preference",
      source: "chat",
      createdAt: "2026-04-05T10:00:00Z",
    })
    expect(result.content).toBe("Student prefers morning study")
  })
})

describe("Extension schema", () => {
  test("re-exports the canonical extension contracts", () => {
    expect(Extension).toBe(ContractsExtension)
    expect(ExtensionManifest).toBe(ContractsExtensionManifest)
    expect(ExtensionLifecycleStatus).toBe(ContractsExtensionLifecycleStatus)
  })

  test("decodes valid extension registry entry", () => {
    const decode = Schema.decodeUnknownSync(Extension)
    const result = decode({
      manifest: {
        id: "canvas-mcp",
        name: "Canvas Assistant",
        description: "Canvas integration",
        version: "1.0.0",
        transport: {
          type: "local_stdio",
          entry: "dist/index.js",
        },
        permissions: ["read"],
        auth: {
          type: "none",
        },
        tools: [
          { name: "get_courses", description: "List courses" },
        ],
        author: "student-claw",
        homepage: "https://github.com/StudentClaw/student-claw",
      },
      installSource: "bundled",
      enabled: true,
      status: "active",
    })
    expect(result.status).toBe("active")
  })

  test("rejects invalid status", () => {
    const decode = Schema.decodeUnknownSync(Extension)
    expect(() => decode({
      manifest: {
        id: "canvas-mcp",
        name: "Canvas",
        description: "Canvas integration",
        version: "1.0.0",
        transport: {
          type: "local_stdio",
          entry: "dist/index.js",
        },
        permissions: [],
        auth: {
          type: "none",
        },
        tools: [],
        author: "student-claw",
        homepage: "https://github.com/StudentClaw/student-claw",
      },
      installSource: "bundled",
      enabled: true,
      status: "broken",
    })).toThrow()
  })
})

describe("StudentPreference schema", () => {
  test("decodes with minimal fields", () => {
    const decode = Schema.decodeUnknownSync(StudentPreference)
    const result = decode({})
    expect(result).toBeDefined()
  })

  test("decodes with all fields", () => {
    const decode = Schema.decodeUnknownSync(StudentPreference)
    const result = decode({
      studyTimes: ["morning", "evening"],
      courseRanking: ["CS101", "MATH201"],
      notificationPrefs: { enabled: true, quietHoursStart: "22:00", quietHoursEnd: "08:00" },
    })
    expect(result.studyTimes).toEqual(["morning", "evening"])
  })
})

describe("OnboardingState schema", () => {
  test("decodes valid state", () => {
    const decode = Schema.decodeUnknownSync(OnboardingState)
    const result = decode({ step: 1, status: "pending" })
    expect(result.step).toBe(1)
  })

  test("rejects invalid status", () => {
    const decode = Schema.decodeUnknownSync(OnboardingState)
    expect(() => decode({ step: 1, status: "done" })).toThrow()
  })
})

describe("Encode/decode roundtrip", () => {
  test("Course roundtrips", () => {
    const decode = Schema.decodeUnknownSync(Course)
    const encode = Schema.encodeSync(Course)
    const original = { id: "c-1", name: "CS", code: "CS101" }
    const decoded = decode(original)
    const encoded = encode(decoded)
    expect(encoded).toEqual(original)
  })
})
