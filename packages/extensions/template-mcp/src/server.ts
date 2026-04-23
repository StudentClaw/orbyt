import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { parseExtensionManifestSync } from "@orbyt/contracts"

export const templateManifest = parseExtensionManifestSync({
  id: "template-mcp",
  name: "Template MCP",
  description: "Starter extension used to validate discovery, registry rendering, and future lifecycle wiring.",
  version: "0.1.0",
  transport: {
    type: "local_stdio",
    entry: "dist/index.js",
  },
  permissions: ["template"],
  auth: {
    type: "none",
  },
  tools: [
    {
      name: "template_ping",
      description: "Placeholder tool metadata for registry and lifecycle testing.",
    },
  ],
  author: "orbyt",
  homepage: "https://github.com/Orbyt/orbyt",
})

export function createTemplateMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: templateManifest.id,
      version: templateManifest.version,
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: "Use template_ping to validate that the Orbyt local MCP lifecycle is working.",
    },
  )

  server.registerTool(
    "template_ping",
    {
      title: "Template ping",
      description: "Return a deterministic lifecycle canary response.",
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async () => ({
      content: [
        {
          type: "text",
          text: "template-pong",
        },
      ],
      isError: false,
    }),
  )

  return server
}

export async function runTemplateMcpServer(): Promise<void> {
  const server = createTemplateMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
