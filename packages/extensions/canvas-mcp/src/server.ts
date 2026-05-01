import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { canvasManifest } from "./manifest.js"
import { CanvasCacheReader, resolveDbPath } from "./sqlite-reader.js"
import { registerCanvasCacheTools } from "./tools.js"

export type CanvasCacheServerOptions = {
  readonly dbPath?: string
  readonly readerFactory?: (dbPath: string) => CanvasCacheReader
}

export const canvasCacheInstructions = [
  "Operate as a read-only Canvas assistant backed by a local cache.",
  "All canvas.* tools return data the server last synced from Canvas (refreshed every 30 minutes).",
  "Do not promise real-time accuracy; if a result looks stale, suggest the student trigger a manual sync.",
].join(" ")

export function createCanvasCacheServer(options: CanvasCacheServerOptions = {}): McpServer {
  const dbPath = options.dbPath ?? resolveDbPath()
  const factory = options.readerFactory ?? ((path: string) => new CanvasCacheReader(path))

  // Open lazily on first tool call so a transient cold-start (DB file not yet
  // created on a fresh install) surfaces as a tool-level error rather than a
  // boot failure that takes the whole MCP down.
  let cached: CanvasCacheReader | null = null
  const reader = (): CanvasCacheReader => {
    if (cached === null) {
      cached = factory(dbPath)
    }
    return cached
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
      instructions: canvasCacheInstructions,
    },
  )

  registerCanvasCacheTools(server, reader)
  return server
}

export async function runCanvasCacheServer(options: CanvasCacheServerOptions = {}): Promise<void> {
  const server = createCanvasCacheServer(options)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
