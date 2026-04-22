import { describe, expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { appleCalendarManifest, createAppleCalendarMcpServer } from "./server.js"

describe("Apple Calendar MCP server", () => {
  test("registers the same tools declared in the manifest", async () => {
    const server = createAppleCalendarMcpServer()
    const client = new Client({ name: "apple-calendar-mcp-test-client", version: "0.1.0" })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    const listed = await client.listTools()
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual(
      appleCalendarManifest.tools.map((tool) => tool.name).sort(),
    )

    await Promise.all([client.close(), server.close()])
  })
})
