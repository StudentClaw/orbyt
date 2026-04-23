import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { CanvasApiError, CanvasPermissionError } from "@orbyt/contracts"
import { canvasServerInstructions, createCanvasMcpServer } from "./server.js"
import { CanvasCredentialStore } from "./runtime.js"
import { canvasStudentReplacementToolInventory } from "./student-tool-contract.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-canvas-mcp-"))
  tempDirs.push(dir)
  return dir
}

async function connectClient(server = createCanvasMcpServer()) {
  const client = new Client({ name: "canvas-mcp-test-client", version: "0.1.0" })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return { client, server }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe("Canvas MCP server", () => {
  test("publishes operational instructions for student Canvas workflows", () => {
    expect(canvasServerInstructions).toContain("prefer get_assignment_details")
    expect(canvasServerInstructions).toContain("module_item_id")
    expect(canvasServerInstructions).toContain("camelCase tool params")
    expect(canvasServerInstructions).toContain("403")
    expect(canvasServerInstructions).toContain("404")
    expect(canvasServerInstructions).toContain("schema mismatch")
  })

  test("registers the replacement student tool surface", async () => {
    const store = new CanvasCredentialStore()
    const { client, server } = await connectClient(createCanvasMcpServer({ credentialStore: store }))

    const listed = await client.listTools()
    const toolNames = listed.tools.map((tool) => tool.name).sort()

    expect(toolNames).toEqual(canvasStudentReplacementToolInventory.map((tool) => tool.name).sort())

    await Promise.all([client.close(), server.close()])
  })

  test("returns a tool error until credentials are supplied", async () => {
    const store = new CanvasCredentialStore()
    const { client, server } = await connectClient(createCanvasMcpServer({ credentialStore: store }))

    const result = await client.callTool({ name: "list_courses", arguments: {} })
    expect(result.isError).toBe(true)
    const content = result.content as Array<{ type?: string }>
    expect(content[0]?.type).toBe("text")

    await Promise.all([client.close(), server.close()])
  })

  test("serves self-scoped upcoming assignments from Canvas upcoming events", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [
            {
              id: 42,
              name: "Biology",
              course_code: "BIO101",
              teachers: [{ id: 7, name: "Dr. Ada Lovelace" }],
            },
          ],
          getUpcomingEvents: async () => [
            {
              id: 10,
              course_id: 42,
              assignment: {
                id: 501,
                course_id: 42,
                name: "Problem Set 1",
                due_at: "2026-04-20T23:59:00Z",
                points_possible: 10,
                html_url: "https://canvas.example.edu/courses/42/assignments/501",
              },
            },
          ],
        }) as never,
    }))

    const result = await client.callTool({ name: "get_my_upcoming_assignments", arguments: {} })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { items: Array<{ title: string }> }).items[0]?.title).toBe("Problem Set 1")

    await Promise.all([client.close(), server.close()])
  })

  test("serves self-scoped upcoming assignments when Canvas returns assignment-style event payloads", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [
            {
              id: 18832,
              name: "C Programming - 31296",
              course_code: "CS 36",
              teachers: [{ id: 7, name: "Dr. Ada Lovelace" }],
            },
          ],
          getUpcomingEvents: async () => [
            {
              id: 522179,
              course_id: 18832,
              name: "Lab 14a - Linked List w/Functions",
              due_at: "2026-04-20T06:59:59Z",
              html_url: "https://ivc-new.instructure.com/courses/18832/assignments/522179",
            },
          ],
        }) as never,
    }))

    const result = await client.callTool({ name: "get_my_upcoming_assignments", arguments: {} })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { items: Array<{ title: string }> }).items[0]?.title).toBe("Lab 14a - Linked List w/Functions")

    await Promise.all([client.close(), server.close()])
  })

  test("derives course grade summaries from student-safe course reads", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCoursesWithEnrollments: async () => [
            {
              id: 42,
              name: "Biology",
              course_code: "BIO101",
              teachers: [{ id: 7, name: "Dr. Ada Lovelace" }],
              enrollments: [{
                id: 1,
                course_id: 42,
                user_id: 99,
                type: "StudentEnrollment",
                enrollment_state: "active",
                grades: {
                  current_score: 92.5,
                  current_grade: "A-",
                  final_score: 93,
                  final_grade: "A",
                },
              }],
            },
          ],
        }) as never,
    }))

    const result = await client.callTool({ name: "get_my_course_grades", arguments: {} })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { courses: Array<{ currentGrade: string }> }).courses[0]?.currentGrade).toBe("A-")

    await Promise.all([client.close(), server.close()])
  })

  test("get_my_submission_status skips courses that deny assignment access", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      now: () => new Date("2026-04-17T18:00:00Z"),
      createClient: () =>
        ({
          getCourses: async () => [
            { id: 1, name: "Biology", course_code: "BIO101" },
            { id: 2, name: "Chemistry", course_code: "CHEM101" },
          ],
          getAssignmentsWithSubmission: async (courseId: string) => {
            if (courseId === "2") {
              throw new CanvasPermissionError({
                message: "Canvas denied access to the requested resource.",
                courseId,
              })
            }

            return [
              {
                id: 101,
                course_id: 1,
                name: "Problem Set 1",
                due_at: "2026-04-20T23:59:00Z",
                submission: {
                  assignment_id: 101,
                  course_id: 1,
                  submitted_at: "2026-04-16T10:00:00Z",
                  workflow_state: "submitted",
                },
              },
            ]
          },
        }) as never,
    }))

    const result = await client.callTool({ name: "get_my_submission_status", arguments: {} })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { submitted: Array<{ title: string }> }).submitted[0]?.title).toBe("Problem Set 1")

    await Promise.all([client.close(), server.close()])
  })

  test("get_course_content_overview ignores a missing front page", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [
            { id: 42, name: "Biology", course_code: "BIO101" },
          ],
          getPages: async () => [
            { page_id: 1, url: "welcome", title: "Welcome" },
          ],
          getModules: async () => [
            { id: 7, name: "Week 1" },
          ],
          getModuleItems: async () => [
            { id: 8, module_id: 7, title: "Read me", type: "Page" },
          ],
          getFrontPage: async () => {
            throw new CanvasApiError({
              message: "Canvas request failed for https://canvas.example.edu/api/v1/courses/42/front_page.",
              statusCode: 404,
            })
          },
        }) as never,
    }))

    const result = await client.callTool({
      name: "get_course_content_overview",
      arguments: { courseId: "canvas-course:42" },
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { pageCount: number }).pageCount).toBe(1)
    expect((structured as { moduleCount: number }).moduleCount).toBe(1)

    await Promise.all([client.close(), server.close()])
  })

  test("course-scoped tools accept course-code aliases from list_courses output", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [
            { id: 42, name: "CS 36", course_code: "202630_CS36_31296" },
          ],
          getAssignmentsWithSubmission: async () => [
            { id: 101, course_id: 42, name: "Project 1" },
          ],
        }) as never,
    }))

    const result = await client.callTool({
      name: "list_assignments",
      arguments: { courseId: "202630_CS36_31296" },
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { items: Array<{ title: string }> }).items[0]?.title).toBe("Project 1")

    await Promise.all([client.close(), server.close()])
  })

  test("get_assignment_details accepts a full Canvas assignment URL", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [
            { id: 18832, name: "CS 36", course_code: "202630_CS36_31296" },
          ],
          getAssignmentWithSubmission: async (courseId: string, assignmentId: string) => ({
            id: Number(assignmentId),
            course_id: Number(courseId),
            name: "Lab 14a - Linked List w/Functions",
            html_url: `https://canvas.example.edu/courses/${courseId}/assignments/${assignmentId}`,
          }),
        }) as never,
    }))

    const result = await client.callTool({
      name: "get_assignment_details",
      arguments: {
        assignmentId: "https://ivc-new.instructure.com/courses/18832/assignments/522179?module_item_id=1471053",
      },
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { item: { title: string } }).item.title).toBe("Lab 14a - Linked List w/Functions")
    expect((structured as { course: { id: string } }).course.id).toBe("canvas-course:18832")

    await Promise.all([client.close(), server.close()])
  })

  test("get_assignment_details accepts a snake_case assignment_url alias", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [
            { id: 18832, name: "CS 36", course_code: "202630_CS36_31296" },
          ],
          getAssignmentWithSubmission: async (courseId: string, assignmentId: string) => ({
            id: Number(assignmentId),
            course_id: Number(courseId),
            name: "Lab 14a - Linked List w/Functions",
            html_url: `https://canvas.example.edu/courses/${courseId}/assignments/${assignmentId}`,
          }),
        }) as never,
    }))

    const result = await client.callTool({
      name: "get_assignment_details",
      arguments: {
        assignment_url: "https://ivc-new.instructure.com/courses/18832/assignments/522179?module_item_id=1471053",
      },
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { item: { title: string } }).item.title).toBe("Lab 14a - Linked List w/Functions")

    await Promise.all([client.close(), server.close()])
  })

  test("get_assignment_details accepts a generic url alias", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [
            { id: 18832, name: "CS 36", course_code: "202630_CS36_31296" },
          ],
          getAssignmentWithSubmission: async (courseId: string, assignmentId: string) => ({
            id: Number(assignmentId),
            course_id: Number(courseId),
            name: "Lab 14a - Linked List w/Functions",
            html_url: `https://canvas.example.edu/courses/${courseId}/assignments/${assignmentId}`,
          }),
        }) as never,
    }))

    const result = await client.callTool({
      name: "get_assignment_details",
      arguments: {
        url: "https://ivc-new.instructure.com/courses/18832/assignments/522179?module_item_id=1471053",
      },
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { item: { title: string } }).item.title).toBe("Lab 14a - Linked List w/Functions")

    await Promise.all([client.close(), server.close()])
  })

  test("get_assignment_details uses the assignment URL host when it differs from the configured base URL", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.socccd.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: (credentials) => {
        if (credentials.baseUrl === "https://ivc-new.instructure.com") {
          return {
            getCourses: async () => [],
            getAssignmentWithSubmission: async (courseId: string, assignmentId: string) => ({
              id: Number(assignmentId),
              course_id: Number(courseId),
              name: "Lab 14a - Linked List w/Functions",
              html_url: `https://ivc-new.instructure.com/courses/${courseId}/assignments/${assignmentId}`,
            }),
          } as never
        }

        return {
          getCourses: async () => [],
          getAssignmentWithSubmission: async () => {
            throw new CanvasApiError({
              message: `Canvas request failed for ${credentials.baseUrl}/api/v1/courses/18832/assignments/522179.`,
              statusCode: 404,
            })
          },
        } as never
      },
    }))

    const result = await client.callTool({
      name: "get_assignment_details",
      arguments: {
        assignment_url: "https://ivc-new.instructure.com/courses/18832/assignments/522179?module_item_id=1471053",
      },
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { course: { id: string } }).course.id).toBe("canvas-course:18832")
    expect((structured as { item: { htmlUrl: string } }).item.htmlUrl).toContain("ivc-new.instructure.com/courses/18832/assignments/522179")

    await Promise.all([client.close(), server.close()])
  })

  test("get_assignment_details falls back to a direct assignment lookup when course discovery misses the course", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [
            { id: 42, name: "Biology", course_code: "BIO101" },
          ],
          getAssignmentWithSubmission: async (courseId: string, assignmentId: string) => ({
            id: Number(assignmentId),
            course_id: Number(courseId),
            name: "Lab 14a - Linked List w/Functions",
            html_url: `https://canvas.example.edu/courses/${courseId}/assignments/${assignmentId}`,
          }),
        }) as never,
    }))

    const result = await client.callTool({
      name: "get_assignment_details",
      arguments: {
        courseId: "18832",
        assignmentId: "522179",
      },
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { course: { id: string; name: string } }).course.id).toBe("canvas-course:18832")
    expect((structured as { course: { id: string; name: string } }).course.name).toBe("Canvas Course 18832")
    expect((structured as { item: { title: string } }).item.title).toBe("Lab 14a - Linked List w/Functions")

    await Promise.all([client.close(), server.close()])
  })

  test("get_assignment_details accepts numeric course and assignment ids", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [
            { id: 18832, name: "CS 36", course_code: "202630_CS36_31296" },
          ],
          getAssignmentWithSubmission: async (courseId: string, assignmentId: string) => ({
            id: Number(assignmentId),
            course_id: Number(courseId),
            name: "Lab 14a - Linked List w/Functions",
            html_url: `https://canvas.example.edu/courses/${courseId}/assignments/${assignmentId}`,
          }),
        }) as never,
    }))

    const result = await client.callTool({
      name: "get_assignment_details",
      arguments: {
        courseId: 18832,
        assignmentId: 522179,
      },
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { course: { id: string } }).course.id).toBe("canvas-course:18832")
    expect((structured as { item: { title: string } }).item.title).toBe("Lab 14a - Linked List w/Functions")

    await Promise.all([client.close(), server.close()])
  })

  test("list_assignments aggregates across courses when courseId is omitted", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [
            { id: 42, name: "Biology", course_code: "BIO101" },
            { id: 84, name: "Chemistry", course_code: "CHEM101" },
          ],
          getAssignmentsWithSubmission: async (courseId: string) => {
            if (courseId === "84") {
              throw new CanvasPermissionError({
                message: "Canvas denied access to the requested resource.",
                courseId,
              })
            }

            return [
              { id: 101, course_id: 42, name: "Problem Set 1" },
            ]
          },
        }) as never,
    }))

    const result = await client.callTool({
      name: "list_assignments",
      arguments: {},
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { items: Array<{ title: string }> }).items.map((item) => item.title)).toEqual([
      "Problem Set 1",
    ])
    expect((structured as { courses: Array<{ items: Array<{ title: string }> }> }).courses).toHaveLength(2)
    expect((structured as { courses: Array<{ items: Array<{ title: string }> }> }).courses[1]?.items).toEqual([])

    await Promise.all([client.close(), server.close()])
  })

  test("get_course_content_overview aggregates across courses when courseId is omitted", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [
            { id: 42, name: "Biology", course_code: "BIO101" },
            { id: 84, name: "Chemistry", course_code: "CHEM101" },
          ],
          getPages: async (courseId: string) => {
            if (courseId === "42") {
              return [{ page_id: 1, url: "welcome", title: "Welcome" }]
            }

            return [{ page_id: 2, url: "lab", title: "Lab" }]
          },
          getModules: async (courseId: string) => {
            if (courseId === "42") {
              return [{ id: 7, name: "Week 1" }]
            }

            return []
          },
          getModuleItems: async () => [
            { id: 8, module_id: 7, title: "Read me", type: "Page" },
          ],
          getFrontPage: async (courseId: string) => {
            if (courseId === "84") {
              throw new CanvasApiError({
                message: "Canvas request failed for https://canvas.example.edu/api/v1/courses/84/front_page.",
                statusCode: 404,
              })
            }

            return { page_id: 1, url: "welcome", title: "Welcome" }
          },
        }) as never,
    }))

    const result = await client.callTool({
      name: "get_course_content_overview",
      arguments: {},
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { pageCount: number }).pageCount).toBe(2)
    expect((structured as { moduleCount: number }).moduleCount).toBe(1)
    expect((structured as { moduleItemCount: number }).moduleItemCount).toBe(1)
    expect((structured as { courses: Array<{ pageCount: number }> }).courses).toHaveLength(2)

    await Promise.all([client.close(), server.close()])
  })

  test("get_course_structure aggregates across courses when courseId is omitted", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [
            { id: 42, name: "Biology", course_code: "BIO101" },
            { id: 84, name: "Chemistry", course_code: "CHEM101" },
          ],
          getModules: async (courseId: string) => {
            if (courseId === "84") {
              throw new CanvasPermissionError({
                message: "Canvas denied access to the requested resource.",
                courseId,
              })
            }

            return [{ id: 7, name: "Week 1" }]
          },
          getModuleItems: async () => [
            { id: 8, module_id: 7, title: "Read me", type: "Page" },
          ],
        }) as never,
    }))

    const result = await client.callTool({
      name: "get_course_structure",
      arguments: {},
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { courses: Array<{ modules: Array<unknown> }> }).courses).toHaveLength(2)
    expect((structured as { courses: Array<{ modules: Array<unknown> }> }).courses[0]?.modules).toHaveLength(1)
    expect((structured as { courses: Array<{ modules: Array<unknown> }> }).courses[1]?.modules).toEqual([])

    await Promise.all([client.close(), server.close()])
  })

  test("search_canvas_tools only returns the student replacement inventory", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: () => ({}) as never,
    }))

    const result = await client.callTool({
      name: "search_canvas_tools",
      arguments: { query: "discussion", category: "student_action" },
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name)).toEqual([
      "post_discussion_entry",
      "reply_to_discussion_entry",
    ])

    await Promise.all([client.close(), server.close()])
  })

  test("marks multiple conversations as read", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })
    const marked: string[] = []

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          markConversationRead: async (conversationId: string) => {
            marked.push(conversationId)
          },
        }) as never,
    }))

    const result = await client.callTool({
      name: "mark_conversations_read",
      arguments: { conversationIds: ["100", "101"] },
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect(marked).toEqual(["100", "101"])
    expect((structured as { markedCount: number }).markedCount).toBe(2)

    await Promise.all([client.close(), server.close()])
  })

  test("downloads a course file into the workspace-scoped default location", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })
    const workspaceRoot = createTempDir()
    const bytes = new TextEncoder().encode("syllabus")

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      workspaceRoot,
      writableRoots: [workspaceRoot],
      createClient: () =>
        ({
          getCourses: async () => [
            {
              id: 42,
              name: "Biology",
              course_code: "BIO101",
              teachers: [{ id: 7, name: "Dr. Ada Lovelace" }],
            },
          ],
          getCourseFiles: async () => [
            {
              id: 9,
              display_name: "Syllabus PDF",
              filename: "syllabus.pdf",
              url: "https://canvas.example.edu/files/9/download",
              size: bytes.byteLength,
            },
          ],
          downloadAuthorizedFile: async () => bytes.buffer,
        }) as never,
    }))

    const result = await client.callTool({
      name: "download_course_file",
      arguments: { courseId: "canvas-course:42", fileId: "9" },
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined
    const savedPath = (structured as { savedPath: string }).savedPath

    expect(result.isError).toBeFalsy()
    expect(savedPath).toBe(path.join(workspaceRoot, "downloads", "canvas", "42", "syllabus.pdf"))
    expect(() => writeFileSync(path.join(workspaceRoot, "verify.txt"), "ok")).not.toThrow()

    await Promise.all([client.close(), server.close()])
  })

  test("rejects download destinations outside allowed writable roots", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })
    const workspaceRoot = createTempDir()
    const outsideRoot = createTempDir()

    const { client, server } = await connectClient(createCanvasMcpServer({
      credentialStore: store,
      workspaceRoot,
      writableRoots: [workspaceRoot],
      createClient: () =>
        ({
          getCourses: async () => [
            {
              id: 42,
              name: "Biology",
              course_code: "BIO101",
            },
          ],
          getCourseFiles: async () => [
            {
              id: 9,
              display_name: "Syllabus PDF",
              filename: "syllabus.pdf",
              url: "https://canvas.example.edu/files/9/download",
            },
          ],
          downloadAuthorizedFile: async () => new ArrayBuffer(0),
        }) as never,
    }))

    const result = await client.callTool({
      name: "download_course_file",
      arguments: {
        courseId: "canvas-course:42",
        fileId: "9",
        destinationPath: path.join(outsideRoot, "escape.pdf"),
      },
    })

    expect(result.isError).toBe(true)

    await Promise.all([client.close(), server.close()])
  })
})
