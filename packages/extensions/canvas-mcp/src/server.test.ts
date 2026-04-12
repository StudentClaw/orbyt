import { describe, expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { CanvasPermissionError } from "@student-claw/contracts"
import { createCanvasMcpServer } from "./server.js"
import { CanvasCredentialStore } from "./runtime.js"

describe("Canvas MCP server", () => {
  test("registers the expected tool surface", async () => {
    const store = new CanvasCredentialStore()
    const server = createCanvasMcpServer({ credentialStore: store })
    const client = new Client({ name: "canvas-mcp-test-client", version: "0.1.0" })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    const listed = await client.listTools()
    const toolNames = listed.tools.map((tool) => tool.name).sort()

    expect(toolNames).toEqual([
      "get_announcements",
      "get_courses",
      "get_coursework",
      "get_coursework_detail",
      "get_grades",
      "sync_now",
    ])

    await Promise.all([client.close(), server.close()])
  })

  test("returns a tool error until credentials are supplied", async () => {
    const store = new CanvasCredentialStore()
    const server = createCanvasMcpServer({ credentialStore: store })
    const client = new Client({ name: "canvas-mcp-test-client", version: "0.1.0" })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    const result = await client.callTool({ name: "get_courses", arguments: {} })
    expect(result.isError).toBe(true)
    const content = result.content as Array<{ type?: string }>
    expect(content[0]?.type).toBe("text")

    await Promise.all([client.close(), server.close()])
  })

  test("serves normalized course data when a client factory is provided", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const server = createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [
            {
              id: 42,
              name: "Biology",
              course_code: "BIO101",
              teachers: [{ id: 7, name: "Dr. Ada Lovelace" }],
              term: { id: 1, name: "Spring 2026" },
              updated_at: "2026-04-10T12:00:00Z",
            },
          ],
        }) as never,
    })
    const client = new Client({ name: "canvas-mcp-test-client", version: "0.1.0" })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    const result = await client.callTool({ name: "get_courses", arguments: {} })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(structured).toBeDefined()
    expect((structured as { courses: Array<{ code: string }> }).courses[0]?.code).toBe("BIO101")

    await Promise.all([client.close(), server.close()])
  })

  test("get_coursework skips courses that deny assignment access", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const server = createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [
            { id: 1, name: "Biology", course_code: "BIO101" },
            { id: 2, name: "Career Center", course_code: "IVC" },
          ],
          getAssignments: async (courseId: string) => {
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
                due_at: "2026-04-15T23:59:00Z",
                points_possible: 10,
                published: true,
              },
            ]
          },
        }) as never,
    })
    const client = new Client({ name: "canvas-mcp-test-client", version: "0.1.0" })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    const result = await client.callTool({ name: "get_coursework", arguments: {} })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { items: Array<{ title: string }> }).items).toHaveLength(1)
    expect((structured as { items: Array<{ title: string }> }).items[0]?.title).toBe("Problem Set 1")

    await Promise.all([client.close(), server.close()])
  })

  test("sync_now reports partial success when some course endpoints are forbidden", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    const server = createCanvasMcpServer({
      credentialStore: store,
      now: () => new Date("2026-04-11T12:00:00Z"),
      createClient: () =>
        ({
          getCourses: async () => [
            { id: 1, name: "Biology", course_code: "BIO101" },
            { id: 2, name: "Career Center", course_code: "IVC" },
          ],
          getAssignments: async (courseId: string) => {
            if (courseId === "2") {
              throw new CanvasPermissionError({
                message: "Canvas denied access to the requested resource.",
                courseId,
              })
            }
            return [{ id: 101, course_id: 1, name: "Problem Set 1" }]
          },
          getAnnouncements: async (courseId: string) => {
            if (courseId === "2") {
              throw new CanvasPermissionError({
                message: "Canvas denied access to the requested resource.",
                courseId,
              })
            }
            return []
          },
          getEnrollments: async (courseId: string) => {
            if (courseId === "2") {
              throw new CanvasPermissionError({
                message: "Canvas denied access to the requested resource.",
                courseId,
              })
            }
            return [{ id: 88, course_id: 1, user_id: 99, type: "StudentEnrollment", enrollment_state: "active" }]
          },
        }) as never,
    })
    const client = new Client({ name: "canvas-mcp-test-client", version: "0.1.0" })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    const result = await client.callTool({ name: "sync_now", arguments: {} })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect((structured as { state: { message: string } }).state.message).toContain("Skipped 3 permission-denied requests.")

    await Promise.all([client.close(), server.close()])
  })

  test("get_coursework_detail prefers a direct course-scoped assignment lookup", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    let requestedCourseId: string | null = null

    const server = createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [
            { id: 1, name: "Biology", course_code: "BIO101" },
            { id: 2, name: "Java", course_code: "CS201" },
          ],
          getAssignment: async (courseId: string, assignmentId: string) => {
            requestedCourseId = courseId
            if (courseId !== "2" || assignmentId !== "522177") {
              throw new CanvasPermissionError({
                message: "Should not have queried the wrong course.",
                courseId,
              })
            }

            return {
              id: 522177,
              course_id: 2,
              name: "Project 3",
              description: "<p>Build the parser.</p>",
              due_at: "2026-04-15T23:59:00Z",
              points_possible: 50,
              html_url: "https://canvas.example.edu/courses/2/assignments/522177",
              published: true,
            }
          },
          getSubmission: async () => ({
            assignment_id: 522177,
            course_id: 2,
            score: 45,
            grade: "45",
          }),
        }) as never,
    })
    const client = new Client({ name: "canvas-mcp-test-client", version: "0.1.0" })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    const result = await client.callTool({
      name: "get_coursework_detail",
      arguments: { sourceType: "assignment", sourceId: "522177", courseId: "canvas-course:2" },
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect(requestedCourseId).toBe("2")
    expect((structured as { detail: { item: { title: string } } }).detail.item.title).toBe("Project 3")

    await Promise.all([client.close(), server.close()])
  })

  test("get_coursework_detail uses direct module item lookup when moduleId is provided", async () => {
    const store = new CanvasCredentialStore()
    store.setCredentials({ baseUrl: "https://canvas.example.edu", token: "token" })

    let directModuleLookup = false

    const server = createCanvasMcpServer({
      credentialStore: store,
      createClient: () =>
        ({
          getCourses: async () => [{ id: 2, name: "Java", course_code: "CS201" }],
          getModuleItem: async (courseId: string, moduleId: string, itemId: string) => {
            directModuleLookup = courseId === "2" && moduleId === "900" && itemId === "1471037"
            return {
              id: 1471037,
              module_id: 900,
              title: "Project 3",
              type: "Assignment",
              content_id: 522177,
              html_url: "https://canvas.example.edu/courses/2/modules/items/1471037",
            }
          },
          getModules: async () => {
            throw new CanvasPermissionError({
              message: "Should not have needed module scanning.",
            })
          },
        }) as never,
    })
    const client = new Client({ name: "canvas-mcp-test-client", version: "0.1.0" })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    const result = await client.callTool({
      name: "get_coursework_detail",
      arguments: { sourceType: "module", sourceId: "1471037", courseId: "2", moduleId: "900" },
    })
    const structured = "structuredContent" in result ? result.structuredContent : undefined

    expect(result.isError).toBeFalsy()
    expect(directModuleLookup).toBe(true)
    expect((structured as { detail: { item: { title: string } } }).detail.item.title).toBe("Project 3")

    await Promise.all([client.close(), server.close()])
  })
})
