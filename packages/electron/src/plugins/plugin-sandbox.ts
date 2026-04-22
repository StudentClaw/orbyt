import { spawn, type ChildProcess, type Serializable } from "node:child_process"
import process from "node:process"
import { PassThrough } from "node:stream"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { ReadBuffer, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js"
import type { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.js"
import type { JSONRPCMessage, MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js"

export type PluginSandboxOptions = {
  pluginId: string
  command: string
  args: string[]
  cwd: string
  env?: Record<string, string>
}

type CloseListener = (details: { code: number | null; signal: NodeJS.Signals | null }) => void
type RuntimeLogListener = (message: string) => void

function formatPluginLogLine(pluginId: string, chunk: string): string {
  const line = chunk.trim()
  return line.length > 0 ? `[plugin:${pluginId}] ${line}\n` : ""
}

class IpcCapableStdioTransport implements Transport {
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: <T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void

  private readonly readBuffer = new ReadBuffer()
  private readonly stderrStream = new PassThrough()
  private child: ChildProcess | null = null

  constructor(private readonly options: PluginSandboxOptions) {}

  get stderr(): PassThrough {
    return this.stderrStream
  }

  get pid(): number | null {
    return this.child?.pid ?? null
  }

  async start(): Promise<void> {
    if (this.child) {
      throw new Error(`Plugin sandbox for ${this.options.pluginId} is already started`)
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn(this.options.command, this.options.args, {
        env: this.options.env,
        stdio: ["pipe", "pipe", "pipe", "ipc"],
        shell: false,
        windowsHide: process.platform === "win32",
        cwd: this.options.cwd,
      })

      this.child = child

      child.on("error", (error) => {
        reject(error)
        this.onerror?.(error instanceof Error ? error : new Error(String(error)))
      })
      child.on("spawn", () => {
        resolve()
      })
      child.on("close", () => {
        this.child = null
        this.onclose?.()
      })
      child.stdin?.on("error", (error) => {
        this.onerror?.(error instanceof Error ? error : new Error(String(error)))
      })
      child.stdout?.on("data", (chunk: Buffer) => {
        this.readBuffer.append(chunk)
        this.processReadBuffer()
      })
      child.stdout?.on("error", (error) => {
        this.onerror?.(error instanceof Error ? error : new Error(String(error)))
      })

      if (child.stderr) {
        child.stderr.pipe(this.stderrStream)
      }
    })
  }

  send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    return new Promise((resolve) => {
      if (!this.child?.stdin) {
        throw new Error("Not connected")
      }

      const serialized = serializeMessage(message)
      if (this.child.stdin.write(serialized)) {
        resolve()
      } else {
        this.child.stdin.once("drain", resolve)
      }
    })
  }

  sendProcessMessage(message: unknown): void {
    if (!this.child?.connected || typeof this.child.send !== "function") {
      throw new Error(`Plugin ${this.options.pluginId} is not available for runtime messages`)
    }

    this.child.send(message as Serializable)
  }

  async close(): Promise<void> {
    if (!this.child) {
      this.readBuffer.clear()
      return
    }

    const child = this.child
    this.child = null

    const closePromise = new Promise<void>((resolve) => {
      child.once("close", () => resolve())
    })

    try {
      child.stdin?.end()
      child.disconnect?.()
    } catch {
      // ignore shutdown errors
    }

    await Promise.race([closePromise, new Promise<void>((resolve) => setTimeout(resolve, 2000).unref())])

    if (child.exitCode === null) {
      try {
        child.kill("SIGTERM")
      } catch {
        // ignore
      }
      await Promise.race([closePromise, new Promise<void>((resolve) => setTimeout(resolve, 2000).unref())])
    }

    if (child.exitCode === null) {
      try {
        child.kill("SIGKILL")
      } catch {
        // ignore
      }
    }

    this.readBuffer.clear()
  }

  private processReadBuffer(): void {
    while (true) {
      try {
        const message = this.readBuffer.readMessage()
        if (message === null) {
          break
        }

        this.onmessage?.(message)
      } catch (error) {
        this.onerror?.(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }
}

export class PluginSandbox {
  private readonly closeListeners = new Set<CloseListener>()
  private readonly runtimeLogListeners = new Set<RuntimeLogListener>()
  private readonly client = new Client({ name: "student-claw-plugin-manager", version: "0.1.0" })
  private transport: IpcCapableStdioTransport | null = null
  private started = false

  constructor(private readonly options: PluginSandboxOptions) {}

  get pid(): number | null {
    return this.transport?.pid ?? null
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error(`Plugin sandbox for ${this.options.pluginId} is already started`)
    }

    const transport = new IpcCapableStdioTransport(this.options)
    transport.stderr.on("data", (chunk: Buffer | string) => {
      const message = chunk.toString()
      process.stderr.write(formatPluginLogLine(this.options.pluginId, message))
      this.emitRuntimeLog(message)
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
      this.emitRuntimeLog(message)
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

  sendMessage(message: unknown): void {
    if (!this.transport) {
      throw new Error(`Plugin sandbox for ${this.options.pluginId} is not connected`)
    }

    this.transport.sendProcessMessage(message)
  }

  onDidClose(listener: CloseListener): () => void {
    this.closeListeners.add(listener)
    return () => {
      this.closeListeners.delete(listener)
    }
  }

  onRuntimeLog(listener: RuntimeLogListener): () => void {
    this.runtimeLogListeners.add(listener)
    return () => {
      this.runtimeLogListeners.delete(listener)
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

  private emitRuntimeLog(message: string): void {
    const normalized = message.trim()
    if (normalized.length === 0) {
      return
    }

    for (const listener of this.runtimeLogListeners) {
      listener(normalized)
    }
  }
}
