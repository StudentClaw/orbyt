import { describe, expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { createTemplateMcpServer } from "./server.js"

describe("template MCP server", () => {
  test("registers only the template ping tool", async () => {
    const server = createTemplateMcpServer()
    const client = new Client({ name: "template-mcp-test-client", version: "0.1.0" })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    const listed = await client.listTools()
    expect(listed.tools.map((tool) => tool.name)).toEqual(["template_ping"])

    await Promise.all([client.close(), server.close()])
  })

  test("returns the deterministic canary payload", async () => {
    const server = createTemplateMcpServer()
    const client = new Client({ name: "template-mcp-test-client", version: "0.1.0" })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    const result = await client.callTool({ name: "template_ping", arguments: {} })
    expect(result.isError).toBe(false)
    expect(result.content).toEqual([{ type: "text", text: "template-pong" }])

    await Promise.all([client.close(), server.close()])
  })
})
