import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

export type PluginSandboxOptions = {
  pluginId: string
  command: string
  args: string[]
  cwd: string
  env?: Record<string, string>
}

type CloseListener = (details: { code: number | null; signal: NodeJS.Signals | null }) => void

function formatPluginLogLine(pluginId: string, chunk: string): string {
  const line = chunk.trim()
  return line.length > 0 ? `[plugin:${pluginId}] ${line}\n` : ""
}

export class PluginSandbox {
  private readonly closeListeners = new Set<CloseListener>()
  private readonly client = new Client({ name: "student-claw-plugin-manager", version: "0.1.0" })
  private transport: StdioClientTransport | null = null
  private started = false

  constructor(private readonly options: PluginSandboxOptions) {}

  get pid(): number | null {
    return this.transport?.pid ?? null
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error(`Plugin sandbox for ${this.options.pluginId} is already started`)
    }

    const transport = new StdioClientTransport({
      command: this.options.command,
      args: this.options.args,
      cwd: this.options.cwd,
      env: this.options.env,
      stderr: "pipe",
    })

    transport.stderr?.on("data", (chunk: Buffer | string) => {
      process.stderr.write(formatPluginLogLine(this.options.pluginId, chunk.toString()))
    })
    transport.onclose = () => {
      this.started = false
      const details = {
        code: null,
        signal: null,
      }
      for (const listener of this.closeListeners) {
        listener(details)
      }
    }
    transport.onerror = (error) => {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(formatPluginLogLine(this.options.pluginId, message))
    }

    this.transport = transport
    await this.client.connect(transport)
    this.started = true
  }

  async listTools() {
    return this.client.listTools()
  }

  async callTool(name: string, args: Record<string, unknown> = {}) {
    return this.client.callTool({ name, arguments: args })
  }

  onDidClose(listener: CloseListener): () => void {
    this.closeListeners.add(listener)
    return () => {
      this.closeListeners.delete(listener)
    }
  }

  async stop(): Promise<void> {
    const closeTasks: Promise<unknown>[] = []

    closeTasks.push(this.client.close().catch(() => undefined))
    if (this.transport) {
      closeTasks.push(this.transport.close().catch(() => undefined))
    }

    await Promise.all(closeTasks)
    this.transport = null
    this.started = false
  }
}
