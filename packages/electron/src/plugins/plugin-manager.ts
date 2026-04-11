import { existsSync } from "node:fs"
import path from "node:path"
import {
  type ExtensionLifecycleStatus,
  type ExtensionRegistryEntry,
  type PluginLifecycleActionResult,
  type PluginLifecycleEvent,
} from "@student-claw/contracts"
import {
  type AvailablePluginRegistryRecord,
} from "./plugin-registry.js"
import { PluginSandbox, type PluginSandboxOptions } from "./plugin-sandbox.js"

type TimerHandle = ReturnType<typeof globalThis.setTimeout>

type PluginSandboxLike = Pick<PluginSandbox, "start" | "listTools" | "callTool" | "stop" | "onDidClose" | "pid">

type PluginRuntimeState = {
  status: ExtensionLifecycleStatus
  lastError?: string
  sandbox: PluginSandboxLike | null
  idleTimer: TimerHandle | null
}

type PluginSandboxFactory = (record: AvailablePluginRegistryRecord) => PluginSandboxLike

type PluginRegistrySource = Pick<
  import("./plugin-registry.js").PluginRegistry,
  "list" | "getStatus" | "getAvailableRecord"
>

export type PluginManagerOptions = {
  registry: PluginRegistrySource
  emitLifecycleEvent?: (event: PluginLifecycleEvent) => void
  createSandbox?: PluginSandboxFactory
  idleTimeoutMs?: number
  retryDelaysMs?: number[]
  now?: () => Date
  scheduleTimeout?: typeof globalThis.setTimeout
  clearScheduledTimeout?: typeof globalThis.clearTimeout
}

function isRunningStatus(status: ExtensionLifecycleStatus): boolean {
  return status === "starting" || status === "ready" || status === "active" || status === "stopping"
}

function formatUnexpectedExitMessage(pluginId: string, pid: number | null): string {
  return pid
    ? `Plugin ${pluginId} exited unexpectedly (pid ${pid})`
    : `Plugin ${pluginId} exited unexpectedly`
}

function buildSandboxOptions(record: AvailablePluginRegistryRecord): PluginSandboxOptions {
  const extensionDir = path.dirname(record.manifestPath)
  const entryPath = path.resolve(extensionDir, record.entry.manifest.transport.entry)

  if (!existsSync(entryPath)) {
    throw new Error(`Runtime entry not found for ${record.entry.manifest.id}: ${entryPath}`)
  }

  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  )

  return {
    pluginId: record.entry.manifest.id,
    command: process.execPath,
    args: [entryPath],
    cwd: extensionDir,
    env,
  }
}

export class PluginManager {
  private readonly runtimes = new Map<string, PluginRuntimeState>()
  private readonly emitLifecycleEvent: (event: PluginLifecycleEvent) => void
  private readonly createSandbox: PluginSandboxFactory
  private readonly idleTimeoutMs: number
  private readonly retryDelaysMs: number[]
  private readonly now: () => Date
  private readonly scheduleTimeout: typeof globalThis.setTimeout
  private readonly clearScheduledTimeout: typeof globalThis.clearTimeout

  constructor(private readonly options: PluginManagerOptions) {
    this.emitLifecycleEvent = options.emitLifecycleEvent ?? (() => undefined)
    this.createSandbox = options.createSandbox ?? ((record) => new PluginSandbox(buildSandboxOptions(record)))
    this.idleTimeoutMs = options.idleTimeoutMs ?? 30_000
    this.retryDelaysMs = options.retryDelaysMs ?? [250, 500, 1000]
    this.now = options.now ?? (() => new Date())
    this.scheduleTimeout = options.scheduleTimeout ?? globalThis.setTimeout
    this.clearScheduledTimeout = options.clearScheduledTimeout ?? globalThis.clearTimeout
  }

  list(): ExtensionRegistryEntry[] {
    return this.options.registry.list().map((entry) => this.overlayEntry(entry))
  }

  getStatus(pluginId: string): ExtensionRegistryEntry | null {
    const entry = this.options.registry.getStatus(pluginId)
    return entry ? this.overlayEntry(entry) : null
  }

  getSandboxPid(pluginId: string): number | null {
    return this.runtimes.get(pluginId)?.sandbox?.pid ?? null
  }

  async start(pluginId: string): Promise<PluginLifecycleActionResult> {
    const validation = this.validateLifecycleTarget(pluginId)
    if (!validation.ok) {
      return validation.result
    }

    const current = this.runtimes.get(pluginId)
    if (current && isRunningStatus(current.status)) {
      return {
        ok: false,
        pluginId,
        reason: "already_running",
      }
    }

    return this.startOnce(validation.record)
  }

  async stop(pluginId: string): Promise<PluginLifecycleActionResult> {
    const validation = this.validateLifecycleTarget(pluginId)
    if (!validation.ok) {
      return validation.result
    }

    const runtime = this.runtimes.get(pluginId)
    if (!runtime?.sandbox || !isRunningStatus(runtime.status)) {
      return {
        ok: false,
        pluginId,
        reason: "not_running",
      }
    }

    if (runtime.status === "stopping") {
      return {
        ok: true,
        pluginId,
        status: "stopping",
      }
    }

    this.updateRuntime(pluginId, {
      ...runtime,
      status: "stopping",
    })
    this.clearIdleTimer(pluginId)

    await runtime.sandbox.stop()

    this.updateRuntime(pluginId, {
      status: "stopped",
      sandbox: null,
      idleTimer: null,
    })

    return {
      ok: true,
      pluginId,
      status: "stopped",
    }
  }

  async retry(pluginId: string): Promise<PluginLifecycleActionResult> {
    const validation = this.validateLifecycleTarget(pluginId)
    if (!validation.ok) {
      return validation.result
    }

    let lastFailure: PluginLifecycleActionResult = {
      ok: false,
      pluginId,
      reason: "start_failed",
    }

    for (const delayMs of this.retryDelaysMs) {
      await this.delay(delayMs)
      lastFailure = await this.startOnce(validation.record)
      if (lastFailure.ok) {
        return lastFailure
      }
    }

    return lastFailure
  }

  async callTool(pluginId: string, toolName: string, args: Record<string, unknown> = {}) {
    const runtime = this.runtimes.get(pluginId)
    if (!runtime?.sandbox || (runtime.status !== "ready" && runtime.status !== "active")) {
      throw new Error(`Plugin ${pluginId} is not running`)
    }

    const result = await runtime.sandbox.callTool(toolName, args)
    this.updateRuntime(pluginId, {
      ...runtime,
      status: "active",
    })
    this.resetIdleTimer(pluginId, runtime.sandbox)
    return result
  }

  async dispose(): Promise<void> {
    const pluginIds = [...this.runtimes.keys()]
    await Promise.all(pluginIds.map((pluginId) => this.disposeRuntime(pluginId)))
  }

  private async startOnce(record: AvailablePluginRegistryRecord): Promise<PluginLifecycleActionResult> {
    const pluginId = record.entry.manifest.id
    this.clearIdleTimer(pluginId)

    const sandbox = this.createSandbox(record)
    sandbox.onDidClose(() => {
      this.handleUnexpectedClose(pluginId, sandbox)
    })

    this.updateRuntime(pluginId, {
      status: "starting",
      sandbox,
      idleTimer: null,
    })

    try {
      await sandbox.start()

      const listed = await sandbox.listTools()
      const hasCanary = listed.tools.some((tool) => tool.name === "template_ping")
      if (!hasCanary) {
        throw new Error(`Plugin ${pluginId} did not expose template_ping during startup`)
      }

      this.updateRuntime(pluginId, {
        status: "ready",
        sandbox,
        idleTimer: null,
      })

      const canaryResult = await sandbox.callTool("template_ping", {})
      if (canaryResult.isError) {
        throw new Error(`Plugin ${pluginId} failed the template_ping canary call`)
      }

      this.updateRuntime(pluginId, {
        status: "active",
        sandbox,
        idleTimer: null,
      })
      this.resetIdleTimer(pluginId, sandbox)

      return {
        ok: true,
        pluginId,
        status: "active",
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      this.updateRuntime(pluginId, {
        status: "error",
        lastError: message,
        sandbox: null,
        idleTimer: null,
      })
      await sandbox.stop().catch(() => undefined)

      return {
        ok: false,
        pluginId,
        reason: "start_failed",
      }
    }
  }

  private validateLifecycleTarget(pluginId: string):
    | { ok: true; record: AvailablePluginRegistryRecord }
    | { ok: false; result: PluginLifecycleActionResult } {
    const entry = this.options.registry.getStatus(pluginId)
    if (!entry) {
      return {
        ok: false,
        result: {
          ok: false,
          pluginId,
          reason: "plugin_not_found",
        },
      }
    }

    if (entry.kind !== "available") {
      return {
        ok: false,
        result: {
          ok: false,
          pluginId,
          reason: "invalid_plugin",
        },
      }
    }

    if (entry.manifest.transport.type !== "local_stdio") {
      return {
        ok: false,
        result: {
          ok: false,
          pluginId,
          reason: "unsupported_transport",
        },
      }
    }

    const record = this.options.registry.getAvailableRecord(pluginId)
    if (!record) {
      return {
        ok: false,
        result: {
          ok: false,
          pluginId,
          reason: "plugin_not_found",
        },
      }
    }

    return {
      ok: true,
      record,
    }
  }

  private overlayEntry(entry: ExtensionRegistryEntry): ExtensionRegistryEntry {
    if (entry.kind !== "available") {
      return entry
    }

    const runtime = this.runtimes.get(entry.manifest.id)
    if (!runtime) {
      return entry
    }

    return {
      ...entry,
      status: runtime.status,
      lastError: runtime.lastError,
    }
  }

  private updateRuntime(pluginId: string, runtime: PluginRuntimeState): void {
    this.runtimes.set(pluginId, runtime)
    this.emitLifecycleEvent({
      pluginId,
      status: runtime.status,
      emittedAt: this.now().toISOString(),
    })
  }

  private clearIdleTimer(pluginId: string): void {
    const runtime = this.runtimes.get(pluginId)
    if (!runtime?.idleTimer) {
      return
    }

    this.clearScheduledTimeout(runtime.idleTimer)
    runtime.idleTimer = null
  }

  private resetIdleTimer(pluginId: string, sandbox: PluginSandboxLike): void {
    this.clearIdleTimer(pluginId)

    const runtime = this.runtimes.get(pluginId)
    if (!runtime || runtime.sandbox !== sandbox) {
      return
    }

    const idleTimer = this.scheduleTimeout(() => {
      const current = this.runtimes.get(pluginId)
      if (!current || current.sandbox !== sandbox || !isRunningStatus(current.status)) {
        return
      }

      void this.stop(pluginId)
    }, this.idleTimeoutMs)

    this.runtimes.set(pluginId, {
      ...runtime,
      idleTimer,
    })
  }

  private handleUnexpectedClose(pluginId: string, sandbox: PluginSandboxLike): void {
    const runtime = this.runtimes.get(pluginId)
    if (!runtime || runtime.sandbox !== sandbox) {
      return
    }

    if (runtime.status === "stopping" || runtime.status === "stopped" || runtime.status === "error") {
      return
    }

    this.clearIdleTimer(pluginId)
    this.updateRuntime(pluginId, {
      status: "error",
      lastError: formatUnexpectedExitMessage(pluginId, sandbox.pid),
      sandbox: null,
      idleTimer: null,
    })
  }

  private async disposeRuntime(pluginId: string): Promise<void> {
    this.clearIdleTimer(pluginId)
    const runtime = this.runtimes.get(pluginId)
    if (!runtime?.sandbox) {
      this.runtimes.delete(pluginId)
      return
    }

    await runtime.sandbox.stop().catch(() => undefined)
    this.runtimes.delete(pluginId)
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      this.scheduleTimeout(() => resolve(), ms)
    })
  }
}
