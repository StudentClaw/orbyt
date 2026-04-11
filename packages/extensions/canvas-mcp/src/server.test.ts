import { describe, expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
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
})
