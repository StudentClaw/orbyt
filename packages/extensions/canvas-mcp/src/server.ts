import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import type { CanvasPluginCredentials } from "./runtime.js"
import { CanvasCredentialStore } from "./runtime.js"
import { canvasManifest } from "./manifest.js"
import { CanvasClient } from "./canvas-client.js"
import { registerStudentCanvasTools } from "./tools/student-tools.js"
import type { CanvasToolDependencies } from "./tools/shared.js"

export type CanvasServerOptions = {
  credentialStore?: CanvasCredentialStore
  createClient?: (credentials: CanvasPluginCredentials) => CanvasClient
  now?: () => Date
  workspaceRoot?: string
  writableRoots?: string[]
}

export const canvasServerInstructions = [
  "Operate as a student-facing Canvas assistant.",
  "For assignment requests, prefer get_assignment_details and accept full Canvas assignment URLs by extracting the tenant, course ID, and assignment ID.",
  "Use authenticated Canvas tools instead of browser page fetches to judge access to private Canvas content.",
  "Treat module_item_id as Canvas UI context, not as a pageId or fileId.",
  "Prefer camelCase tool params such as courseId, assignmentId, assignmentUrl, moduleId, pageId, and fileId.",
  "For file requests, try Canvas file tools first; if Canvas denies course-file listing or download, a direct authenticated file-download fallback may still work.",
  "Interpret 403 as a permission boundary, 404 as the wrong tenant, path, or resource, and schema mismatch as a signal to retry with a narrower or fallback Canvas path.",
  "A direct assignment lookup may succeed even when course discovery does not list that course first.",
  "When available, summarize due dates, submission state, points, module context, and starter-file links concisely.",
].join(" ")

export function createCanvasMcpServer(options?: CanvasServerOptions): McpServer {
  const credentialStore = options?.credentialStore ?? new CanvasCredentialStore()
  const deps: CanvasToolDependencies = {
    now: options?.now ?? (() => new Date()),
    getCredentials: () => credentialStore.requireCredentials(),
    createClient: options?.createClient,
    workspaceRoot: options?.workspaceRoot,
    writableRoots: options?.writableRoots,
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
      instructions: canvasServerInstructions,
    },
  )

  registerStudentCanvasTools(server, deps)

  return server
}

export async function runCanvasMcpServer(options?: CanvasServerOptions): Promise<void> {
  const server = createCanvasMcpServer(options)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
