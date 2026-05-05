import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import path from "node:path"
import {
  type ExtensionLifecycleStatus,
  type ExtensionRegistryEntry,
  type PluginRuntimeLogEntry,
  type PluginReadinessEvent,
  type PluginRetryClass,
  type ExtensionRuntimeReadiness,
  type PluginLifecycleActionResult,
  type PluginLifecycleEvent,
} from "@orbyt/contracts"
import {
  type AvailablePluginRegistryRecord,
} from "./plugin-registry.js"
import type { PluginRuntimePreparation } from "./plugin-runtime-preparation.js"
import { PluginSandbox, type PluginSandboxOptions } from "./plugin-sandbox.js"
import type { PluginEnabledStore } from "./plugin-enabled-store.js"

type TimerHandle = ReturnType<typeof globalThis.setTimeout>

type PluginSandboxLike = Pick<PluginSandbox, "start" | "listTools" | "callTool" | "sendMessage" | "stop" | "onDidClose" | "onRuntimeLog" | "pid">

type PluginRuntimeState = {
  status: ExtensionLifecycleStatus
  readiness?: ExtensionRuntimeReadiness
  lastError?: string
  sandbox: PluginSandboxLike | null
  idleTimer: TimerHandle | null
}

type PluginSandboxFactory = (record: AvailablePluginRegistryRecord, runtimeEnv?: Record<string, string>) => PluginSandboxLike

type PluginRegistrySource = Pick<
  import("./plugin-registry.js").PluginRegistry,
  "list" | "getStatus" | "getAvailableRecord"
>

export type PluginManagerOptions = {
  registry: PluginRegistrySource
  emitLifecycleEvent?: (event: PluginLifecycleEvent) => void
  emitReadinessEvent?: (event: PluginReadinessEvent) => void
  emitRuntimeLog?: (entry: PluginRuntimeLogEntry) => void
  createSandbox?: PluginSandboxFactory
  idleTimeoutMs?: number | null
  retryDelaysMs?: number[]
  getCredentialMessage?: (pluginId: string) => unknown | null
  prepareRuntime?: (record: AvailablePluginRegistryRecord) => Promise<PluginRuntimePreparation | null> | PluginRuntimePreparation | null
  cleanupRuntime?: (record: AvailablePluginRegistryRecord) => Promise<void> | void
  shouldAutoStart?: (entry: Extract<ExtensionRegistryEntry, { kind: "available" }>) => boolean
  now?: () => Date
  scheduleTimeout?: typeof globalThis.setTimeout
  clearScheduledTimeout?: typeof globalThis.clearTimeout
  enabledStore?: PluginEnabledStore
}

function isRunningStatus(status: ExtensionLifecycleStatus): boolean {
  return status === "starting" || status === "ready" || status === "active" || status === "stopping"
}

function formatUnexpectedExitMessage(pluginId: string, pid: number | null): string {
  return pid
    ? `Plugin ${pluginId} exited unexpectedly (pid ${pid})`
    : `Plugin ${pluginId} exited unexpectedly`
}

export function applyPluginSandboxEnv(baseEnv: Record<string, string>, isElectronRuntime = Boolean(process.versions.electron)): Record<string, string> {
  if (!isElectronRuntime) {
    return baseEnv
  }

  return {
    ...baseEnv,
    ELECTRON_RUN_AS_NODE: "1",
  }
}

export function buildSandboxOptions(
  record: AvailablePluginRegistryRecord,
  runtimeEnv: Record<string, string> = {},
): PluginSandboxOptions {
  const extensionDir = path.dirname(record.manifestPath)
  const entryPath = path.resolve(extensionDir, record.entry.manifest.transport.entry)

  if (!existsSync(entryPath)) {
    throw new Error(`Runtime entry not found for ${record.entry.manifest.id}: ${entryPath}`)
  }

  const env = applyPluginSandboxEnv({
    ...Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    ),
    ...runtimeEnv,
  })

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
  private readonly activeOperationContexts = new Map<string, { retryClass?: PluginRetryClass; correlationId?: string }>()
  private readonly emitLifecycleEvent: (event: PluginLifecycleEvent) => void
  private readonly emitReadinessEvent: (event: PluginReadinessEvent) => void
  private readonly emitRuntimeLog: (entry: PluginRuntimeLogEntry) => void
  private readonly createSandbox: PluginSandboxFactory
  private readonly idleTimeoutMs: number | null
  private readonly retryDelaysMs: number[]
  private readonly getCredentialMessage: (pluginId: string) => unknown | null
  private readonly prepareRuntime: (record: AvailablePluginRegistryRecord) => Promise<PluginRuntimePreparation | null>
  private readonly cleanupRuntime: (record: AvailablePluginRegistryRecord) => Promise<void>
  private readonly shouldAutoStart: (entry: Extract<ExtensionRegistryEntry, { kind: "available" }>) => boolean
  private readonly now: () => Date
  private readonly scheduleTimeout: typeof globalThis.setTimeout
  private readonly clearScheduledTimeout: typeof globalThis.clearTimeout

  constructor(private readonly options: PluginManagerOptions) {
    this.emitLifecycleEvent = options.emitLifecycleEvent ?? (() => undefined)
    this.emitReadinessEvent = options.emitReadinessEvent ?? (() => undefined)
    this.emitRuntimeLog = options.emitRuntimeLog ?? (() => undefined)
    this.createSandbox = options.createSandbox ?? ((record, runtimeEnv) => new PluginSandbox(buildSandboxOptions(record, runtimeEnv)))
    this.idleTimeoutMs = options.idleTimeoutMs ?? null
    this.retryDelaysMs = options.retryDelaysMs ?? [250, 500, 1000]
    this.getCredentialMessage = options.getCredentialMessage ?? (() => null)
    this.prepareRuntime = async (record) => await (options.prepareRuntime?.(record) ?? null)
    this.cleanupRuntime = async (record) => await (options.cleanupRuntime?.(record) ?? undefined)
    this.shouldAutoStart = options.shouldAutoStart ?? (() => true)
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
    this.activeOperationContexts.delete(pluginId)

    const runtime = this.runtimes.get(pluginId)
    if (!runtime?.sandbox || !isRunningStatus(runtime.status)) {
      this.clearIdleTimer(pluginId)
      this.updateRuntime(pluginId, {
        status: "stopped",
        readiness: undefined,
        sandbox: null,
        idleTimer: null,
      })
      await this.cleanupRuntime(validation.record)
      return {
        ok: true,
        pluginId,
        status: "stopped",
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
      readiness: undefined,
      sandbox: null,
      idleTimer: null,
    })
    await this.cleanupRuntime(validation.record)

    return {
      ok: true,
      pluginId,
      status: "stopped",
    }
  }

  async retry(pluginId: string, retryClass: PluginRetryClass = "retry_plugin_start"): Promise<PluginLifecycleActionResult> {
    const validation = this.validateLifecycleTarget(pluginId)
    if (!validation.ok) {
      return validation.result
    }

    const operationContext = {
      retryClass,
      correlationId: randomUUID(),
    }
    this.activeOperationContexts.set(pluginId, operationContext)

    if (retryClass === "retry_bridge_start") {
      await this.cleanupRuntime(validation.record).catch(() => undefined)
    }

    try {
      let lastFailure: PluginLifecycleActionResult = {
        ok: false,
        pluginId,
        reason: "start_failed",
      }

      for (const delayMs of this.retryDelaysMs) {
        await this.delay(delayMs)
        lastFailure = await this.startOnce(validation.record, operationContext)
        if (lastFailure.ok) {
          return lastFailure
        }
      }

      return lastFailure
    } finally {
      this.activeOperationContexts.delete(pluginId)
    }
  }

  async refreshReadiness(pluginId: string): Promise<ExtensionRegistryEntry | null> {
    const validation = this.validateLifecycleTarget(pluginId)
    if (!validation.ok) {
      return this.getStatus(pluginId)
    }

    const current = this.runtimes.get(pluginId)
    const runtimePreparation = await this.prepareRuntime(validation.record)
    if (!runtimePreparation) {
      return this.getStatus(pluginId)
    }

    const fallbackStatus = current?.status
      ?? (this.options.enabledStore?.isEnabled(pluginId) ? "discovered" : validation.record.entry.status)

    this.updateRuntime(pluginId, {
      status: fallbackStatus,
      readiness: runtimePreparation.readiness,
      lastError: runtimePreparation.readiness === "ready" ? undefined : runtimePreparation.lastError,
      sandbox: current?.sandbox ?? null,
      idleTimer: current?.idleTimer ?? null,
    })

    return this.getStatus(pluginId)
  }

  async callTool(pluginId: string, toolName: string, args: Record<string, unknown> = {}) {
    const runtime = this.runtimes.get(pluginId)
    if (!runtime?.sandbox || (runtime.status !== "ready" && runtime.status !== "active")) {
      throw new Error(`Plugin ${pluginId} is not running`)
    }

    const operationContext = {
      correlationId: randomUUID(),
    }
    this.activeOperationContexts.set(pluginId, operationContext)

    try {
      const result = await runtime.sandbox.callTool(toolName, args)
      this.updateRuntime(pluginId, {
        ...runtime,
        status: "active",
      })
      this.resetIdleTimer(pluginId, runtime.sandbox)
      return result
    } finally {
      this.activeOperationContexts.delete(pluginId)
    }
  }

  async autoStartEnabled(): Promise<void> {
    const enabled = this.list().filter((entry): entry is Extract<ExtensionRegistryEntry, { kind: "available" }> => {
      return entry.kind === "available" && entry.enabled && this.shouldAutoStart(entry)
    })
    await Promise.all(enabled.map((entry) => this.start(entry.manifest.id)))
  }

  async dispose(): Promise<void> {
    const pluginIds = [...this.runtimes.keys()]
    await Promise.all(pluginIds.map((pluginId) => this.disposeRuntime(pluginId)))
  }

  private async startOnce(
    record: AvailablePluginRegistryRecord,
    eventContext: { retryClass?: PluginRetryClass; correlationId?: string } = {},
  ): Promise<PluginLifecycleActionResult> {
    const pluginId = record.entry.manifest.id
    this.clearIdleTimer(pluginId)

    const runtimePreparation = await this.prepareRuntime(record)
    if (runtimePreparation && runtimePreparation.readiness !== "ready") {
      this.updateRuntime(pluginId, {
        status: "error",
        readiness: runtimePreparation.readiness,
        lastError: runtimePreparation.lastError,
        sandbox: null,
        idleTimer: null,
      })

      return {
        ok: false,
        pluginId,
        reason: "start_failed",
      }
    }

    const sandbox = this.createSandbox(record, runtimePreparation?.env)
    sandbox.onRuntimeLog((message) => {
      this.emitRuntimeLog({
        pluginId,
        source: "mcp",
        message,
        emittedAt: this.now().toISOString(),
        readiness: this.runtimes.get(pluginId)?.readiness,
        lifecycleStatus: this.runtimes.get(pluginId)?.status,
        retryClass: this.activeOperationContexts.get(pluginId)?.retryClass,
        correlationId: this.activeOperationContexts.get(pluginId)?.correlationId,
      })
    })
    sandbox.onDidClose(() => {
      this.handleUnexpectedClose(pluginId, sandbox)
    })

    this.updateRuntime(pluginId, {
      status: "starting",
      readiness: runtimePreparation ? "bridge_starting" : undefined,
      sandbox,
      idleTimer: null,
    }, eventContext)

    try {
      await sandbox.start()

      const listed = await sandbox.listTools()
      const expectedTools = record.entry.manifest.tools.map((tool) => tool.name)
      const exposedTools = new Set(listed.tools.map((tool) => tool.name))
      const missingTools = expectedTools.filter((toolName) => !exposedTools.has(toolName))
      if (missingTools.length > 0) {
        throw new Error(`Plugin ${pluginId} did not expose expected tools: ${missingTools.join(", ")}`)
      }

      this.updateRuntime(pluginId, {
        status: "ready",
        readiness: runtimePreparation?.readiness ?? "ready",
        sandbox,
        idleTimer: null,
      }, eventContext)

      const credentialMessage = this.getCredentialMessage(pluginId)
      if (credentialMessage) {
        sandbox.sendMessage(credentialMessage)
      }

      if (exposedTools.has("template_ping")) {
        const canaryResult = await sandbox.callTool("template_ping", {})
        if (canaryResult.isError) {
          throw new Error(`Plugin ${pluginId} failed the template_ping canary call`)
        }
      }

      this.updateRuntime(pluginId, {
        status: "active",
        readiness: runtimePreparation?.readiness ?? "ready",
        sandbox,
        idleTimer: null,
      }, eventContext)
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
        readiness: runtimePreparation?.readiness ?? "error",
        lastError: message,
        sandbox: null,
        idleTimer: null,
      }, eventContext)
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

    const pluginId = entry.manifest.id
    const runtime = this.runtimes.get(pluginId)
    const enabled = this.options.enabledStore?.isEnabled(pluginId) ?? entry.enabled

    if (!runtime) {
      return { ...entry, enabled }
    }

    return {
      ...entry,
      enabled,
      status: runtime.status,
      readiness: runtime.readiness,
      lastError: runtime.lastError,
    }
  }

  private updateRuntime(
    pluginId: string,
    runtime: PluginRuntimeState,
    eventContext: { retryClass?: PluginRetryClass } = {},
  ): void {
    const previous = this.runtimes.get(pluginId)
    this.runtimes.set(pluginId, runtime)
    const emittedAt = this.now().toISOString()

    if (!previous || previous.status !== runtime.status) {
      this.emitLifecycleEvent({
        pluginId,
        status: runtime.status,
        emittedAt,
      })
    }

    if (
      runtime.readiness
      && (
        !previous
        || previous.readiness !== runtime.readiness
        || previous.lastError !== runtime.lastError
      )
    ) {
      this.emitReadinessEvent({
        pluginId,
        readiness: runtime.readiness,
        previousReadiness: previous?.readiness,
        lastError: runtime.lastError,
        retryClass: eventContext.retryClass,
        emittedAt,
      })
    }
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
    if (!runtime || runtime.sandbox !== sandbox || this.idleTimeoutMs === null) {
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
      readiness: runtime.readiness ? "error" : undefined,
      lastError: formatUnexpectedExitMessage(pluginId, sandbox.pid),
      sandbox: null,
      idleTimer: null,
    })
  }

  private async disposeRuntime(pluginId: string): Promise<void> {
    this.clearIdleTimer(pluginId)
    const record = this.options.registry.getAvailableRecord(pluginId)
    const runtime = this.runtimes.get(pluginId)
    if (!runtime?.sandbox) {
      if (record) {
        await this.cleanupRuntime(record).catch(() => undefined)
      }
      this.runtimes.delete(pluginId)
      return
    }

    await runtime.sandbox.stop().catch(() => undefined)
    if (record) {
      await this.cleanupRuntime(record).catch(() => undefined)
    }
    this.runtimes.delete(pluginId)
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      this.scheduleTimeout(() => resolve(), ms)
    })
  }
}
