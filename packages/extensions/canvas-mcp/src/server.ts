import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import type { CanvasPluginCredentials } from "./runtime.js"
import { CanvasCredentialStore } from "./runtime.js"
import { canvasManifest } from "./manifest.js"
import { CanvasClient } from "./canvas-client.js"
import { registerGetAnnouncementsTool } from "./tools/get-announcements.js"
import { registerGetCoursesTool } from "./tools/get-courses.js"
import { registerGetCourseworkDetailTool } from "./tools/get-coursework-detail.js"
import { registerGetCourseworkTool } from "./tools/get-coursework.js"
import { registerGetGradesTool } from "./tools/get-grades.js"
import { registerSyncNowTool } from "./tools/sync-now.js"
import type { CanvasToolDependencies } from "./tools/shared.js"

export type CanvasServerOptions = {
  credentialStore?: CanvasCredentialStore
  createClient?: (credentials: CanvasPluginCredentials) => CanvasClient
  now?: () => Date
}

export function createCanvasMcpServer(options?: CanvasServerOptions): McpServer {
  const credentialStore = options?.credentialStore ?? new CanvasCredentialStore()
  const deps: CanvasToolDependencies = {
    now: options?.now ?? (() => new Date()),
    getCredentials: () => credentialStore.requireCredentials(),
    createClient: options?.createClient,
  }

  const server = new McpServer(
    {
      name: canvasManifest.id,
      version: canvasManifest.version,
    },
    {
      capabilities: {
        tools: {},
        logging: {},
      },
      instructions:
        "Use these tools to read Canvas courses, coursework, grades, announcements, and to trigger an immediate refresh read.",
    },
  )

  registerGetCoursesTool(server, deps)
  registerGetCourseworkTool(server, deps)
  registerGetCourseworkDetailTool(server, deps)
  registerGetGradesTool(server, deps)
  registerGetAnnouncementsTool(server, deps)
  registerSyncNowTool(server, deps)

  return server
}

export async function runCanvasMcpServer(options?: CanvasServerOptions): Promise<void> {
  const server = createCanvasMcpServer(options)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
