import { randomBytes } from "node:crypto"
import { spawn, type ChildProcess } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import path from "node:path"
import type { PluginRuntimeLogEntry } from "@student-claw/contracts"
import type { PluginRuntimePreparation } from "./plugin-runtime-preparation.js"
import { APPLE_BRIDGE_BINARY_NAME, resolvePackagedAppleCalendarBridgePaths } from "./apple-calendar-bridge-paths.js"

type BridgeLaunchConfig = {
  command: string
  args: string[]
  cwd: string
  env: Record<string, string>
}

type RequestLike = Pick<Response, "ok" | "status" | "text">

type BridgeProcess = Pick<ChildProcess, "pid" | "kill" | "on" | "once" | "stderr">

type AppleCalendarBridgeManagerOptions = {
  currentDir: string
  isPackaged: boolean
  resourcesPath?: string
  platform?: NodeJS.Platform
  allocatePort?: () => Promise<number>
  createToken?: () => string
  resolveLaunch?: (options: {
    currentDir: string
    isPackaged: boolean
    resourcesPath?: string
    port: number
    token: string
  }) => BridgeLaunchConfig
  spawnProcess?: (launch: BridgeLaunchConfig) => BridgeProcess
  request?: (input: string, init?: RequestInit) => Promise<RequestLike>
  sleep?: (ms: number) => Promise<void>
  emitRuntimeLog?: (entry: PluginRuntimeLogEntry) => void
  now?: () => Date
  reachableRetryDelaysMs?: number[]
  crashLoopThreshold?: number
  crashLoopWindowMs?: number
}

type ManagedBridge = {
  child: BridgeProcess
  port: number
  token: string
  url: string
  startError?: string
}

async function allocateEphemeralPort(): Promise<number> {
  const net = await import("node:net")

  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate Apple Calendar bridge port.")))
        return
      }

      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(address.port)
      })
    })
  })
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createBridgeToken(): string {
  return randomBytes(16).toString("hex")
}

function createHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  }
}

function buildBridgeUrl(port: number): string {
  return `http://127.0.0.1:${port}`
}

function resolveBuiltBridgeExecutable(bridgeRoot: string): string | null {
  const directReleaseExecutable = path.join(bridgeRoot, ".build", "release", APPLE_BRIDGE_BINARY_NAME)
  if (existsSync(directReleaseExecutable)) {
    return directReleaseExecutable
  }

  const buildRoot = path.join(bridgeRoot, ".build")
  if (!existsSync(buildRoot)) {
    return null
  }

  for (const entry of readdirSync(buildRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    const candidate = path.join(buildRoot, entry.name, "release", APPLE_BRIDGE_BINARY_NAME)
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

function resolveDevBridgeRoot(currentDir: string): string {
  const bridgeRoots: [string, string] = [
    path.resolve(currentDir, "../../extensions/apple-calendar-mcp/bridge"),
    path.resolve(currentDir, "../../../extensions/apple-calendar-mcp/bridge"),
  ]

  return bridgeRoots.find(existsSync) ?? bridgeRoots[0]
}

function formatBridgeStartError(command: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes("ENOENT")) {
    if (command === "/usr/bin/swift" || command.endsWith("/swift") || command === "swift") {
      return "Swift was not found for the Apple Calendar bridge. Install Xcode Command Line Tools or build the vendored bridge binary first."
    }

    return `Apple Calendar bridge executable was not found: ${command}`
  }

  return message
}

function normalizePermissionError(message: string): string {
  const trimmed = message.trim()
  if (trimmed.length === 0) {
    return "Calendar permission is required."
  }

  try {
    const parsed = JSON.parse(trimmed) as { error?: unknown }
    if (typeof parsed.error === "string" && parsed.error.trim().length > 0) {
      return parsed.error.trim()
    }
  } catch {
    // Keep the raw message below.
  }

  return trimmed
}

export function resolveAppleCalendarBridgeLaunch(options: {
  currentDir: string
  isPackaged: boolean
  resourcesPath?: string
  port: number
  token: string
}): BridgeLaunchConfig {
  if (!options.isPackaged) {
    const bridgeRoot = resolveDevBridgeRoot(options.currentDir)
    const releaseExecutable = resolveBuiltBridgeExecutable(bridgeRoot)

    if (releaseExecutable) {
      return {
        command: releaseExecutable,
        args: [],
        cwd: bridgeRoot,
        env: {
          PORT: String(options.port),
          MAC_API_BRIDGE_TOKEN: options.token,
          HOST: "127.0.0.1",
        },
      }
    }

    return {
      command: "/usr/bin/swift",
      args: ["run", "CalendarAPIBridge"],
      cwd: bridgeRoot,
      env: {
        PORT: String(options.port),
        MAC_API_BRIDGE_TOKEN: options.token,
        HOST: "127.0.0.1",
      },
    }
  }

  const resourcesRoot = options.resourcesPath ?? process.resourcesPath ?? ""
  const { bridgeDir, executablePath } = resolvePackagedAppleCalendarBridgePaths(resourcesRoot)

  return {
    command: executablePath,
    args: [],
    cwd: bridgeDir,
    env: {
      PORT: String(options.port),
      MAC_API_BRIDGE_TOKEN: options.token,
      HOST: "127.0.0.1",
    },
  }
}

export class AppleCalendarBridgeManager {
  private current: ManagedBridge | null = null
  private readonly crashTimestamps: number[] = []
  private readonly stoppingChildren = new Set<BridgeProcess>()
  private readonly platform: NodeJS.Platform
  private readonly allocatePort: () => Promise<number>
  private readonly createToken: () => string
  private readonly resolveLaunch: AppleCalendarBridgeManagerOptions["resolveLaunch"]
  private readonly spawnProcess: (launch: BridgeLaunchConfig) => BridgeProcess
  private readonly request: (input: string, init?: RequestInit) => Promise<RequestLike>
  private readonly sleep: (ms: number) => Promise<void>
  private readonly emitRuntimeLog: (entry: PluginRuntimeLogEntry) => void
  private readonly now: () => Date
  private readonly reachableRetryDelaysMs: number[]
  private readonly crashLoopThreshold: number
  private readonly crashLoopWindowMs: number

  constructor(private readonly options: AppleCalendarBridgeManagerOptions) {
    this.platform = options.platform ?? process.platform
    this.allocatePort = options.allocatePort ?? allocateEphemeralPort
    this.createToken = options.createToken ?? createBridgeToken
    this.resolveLaunch = options.resolveLaunch ?? resolveAppleCalendarBridgeLaunch
    this.spawnProcess = options.spawnProcess ?? ((launch) => spawn(launch.command, launch.args, {
      cwd: launch.cwd,
      env: {
        ...process.env,
        ...launch.env,
      },
      shell: false,
      stdio: ["ignore", "ignore", "pipe"],
    }))
    this.request = options.request ?? (async (input, init) => await fetch(input, init))
    this.sleep = options.sleep ?? defaultSleep
    this.emitRuntimeLog = options.emitRuntimeLog ?? (() => undefined)
    this.now = options.now ?? (() => new Date())
    this.reachableRetryDelaysMs = options.reachableRetryDelaysMs ?? [250, 500, 1000, 2000, 4000]
    this.crashLoopThreshold = options.crashLoopThreshold ?? 3
    this.crashLoopWindowMs = options.crashLoopWindowMs ?? 60_000
  }

  async ensureReady(): Promise<PluginRuntimePreparation> {
    if (this.platform !== "darwin") {
      return {
        readiness: "platform_unsupported",
        lastError: "Apple Calendar is only available on macOS.",
      }
    }

    if (this.isCrashLooping()) {
      return {
        readiness: "bridge_crash_loop",
        lastError: "Apple Calendar bridge is crash-looping. Retry after restarting the app or bridge.",
      }
    }

    if (this.current) {
      const reprobe = await this.probeCurrentBridge(this.current)
      if (reprobe.readiness === "ready" || reprobe.readiness === "permission_required") {
        return reprobe
      }
    }

    await this.stop()

    const port = await this.allocatePort()
    const token = this.createToken()
    const launch = this.resolveLaunch!({
      currentDir: this.options.currentDir,
      isPackaged: this.options.isPackaged,
      resourcesPath: this.options.resourcesPath,
      port,
      token,
    })

    const child = this.spawnProcess(launch)
    const bridge: ManagedBridge = {
      child,
      port,
      token,
      url: buildBridgeUrl(port),
    }
    this.current = bridge
    this.attachLifecycle(bridge)

    const reachable = await this.waitUntilReachable(bridge)
    if (!reachable) {
      await this.stop()
      return this.isCrashLooping()
        ? {
            readiness: "bridge_crash_loop",
            lastError: "Apple Calendar bridge is crash-looping. Retry after restarting the app or bridge.",
          }
        : {
            readiness: "bridge_unavailable",
            lastError: bridge.startError ?? "Apple Calendar bridge is unavailable.",
          }
    }

    return this.probePermission(bridge)
  }

  async stop(): Promise<void> {
    const current = this.current
    this.current = null
    if (!current) {
      return
    }

    this.stoppingChildren.add(current.child)
    try {
      current.child.kill("SIGTERM")
    } catch {
      // Ignore shutdown errors for failed or already-exited children.
    }
  }

  async dispose(): Promise<void> {
    await this.stop()
  }

  private attachLifecycle(bridge: ManagedBridge): void {
    bridge.child.stderr?.on("data", (chunk: Buffer | string) => {
      for (const line of chunk.toString().split("\n").map((entry) => entry.trim()).filter(Boolean)) {
        this.emitRuntimeLog({
          pluginId: "apple-calendar-mcp",
          source: "bridge",
          message: line,
          emittedAt: this.now().toISOString(),
        })
      }
    })

    bridge.child.on("error", (error) => {
      const message = formatBridgeStartError(
        this.resolveLaunch!({
          currentDir: this.options.currentDir,
          isPackaged: this.options.isPackaged,
          resourcesPath: this.options.resourcesPath,
          port: bridge.port,
          token: bridge.token,
        }).command,
        error,
      )
      bridge.startError = message
      this.emitRuntimeLog({
        pluginId: "apple-calendar-mcp",
        source: "bridge",
        message,
        emittedAt: this.now().toISOString(),
        readiness: "bridge_unavailable",
      })
    })

    bridge.child.on("close", () => {
      if (this.stoppingChildren.has(bridge.child)) {
        this.stoppingChildren.delete(bridge.child)
      } else {
        this.recordCrash()
      }
      if (this.current?.child === bridge.child) {
        this.current = null
      }
    })
  }

  private recordCrash(): void {
    const now = this.now().getTime()
    this.crashTimestamps.push(now)
    this.pruneCrashWindow(now)
  }

  private pruneCrashWindow(now = this.now().getTime()): void {
    while (this.crashTimestamps.length > 0 && now - this.crashTimestamps[0]! > this.crashLoopWindowMs) {
      this.crashTimestamps.shift()
    }
  }

  private isCrashLooping(): boolean {
    this.pruneCrashWindow()
    return this.crashTimestamps.length >= this.crashLoopThreshold
  }

  private async probeCurrentBridge(bridge: ManagedBridge): Promise<PluginRuntimePreparation> {
    if (bridge.startError) {
      return {
        readiness: "bridge_unavailable",
        lastError: bridge.startError,
      }
    }

    const reachable = await this.probeHealth(bridge)
    if (!reachable) {
      return {
        readiness: "bridge_unavailable",
        lastError: bridge.startError ?? "Apple Calendar bridge is unavailable.",
      }
    }

    return this.probePermission(bridge)
  }

  private async waitUntilReachable(bridge: ManagedBridge): Promise<boolean> {
    if (bridge.startError) {
      return false
    }

    if (await this.probeHealth(bridge)) {
      return true
    }

    for (const delayMs of this.reachableRetryDelaysMs) {
      await this.sleep(delayMs)
      if (bridge.startError) {
        return false
      }
      if (await this.probeHealth(bridge)) {
        return true
      }
    }

    return false
  }

  private async probeHealth(bridge: ManagedBridge): Promise<boolean> {
    try {
      const response = await this.request(`${bridge.url}/health`, {
        headers: createHeaders(bridge.token),
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async probePermission(bridge: ManagedBridge): Promise<PluginRuntimePreparation> {
    try {
      const response = await this.request(`${bridge.url}/calendars`, {
        headers: createHeaders(bridge.token),
      })
      if (response.ok) {
        return {
          readiness: "ready",
          env: {
            MAC_API_BRIDGE_URL: bridge.url,
            MAC_API_BRIDGE_TOKEN: bridge.token,
          },
        }
      }

      return {
        readiness: "permission_required",
        lastError: normalizePermissionError(await response.text()),
      }
    } catch (error) {
      return {
        readiness: "permission_required",
        lastError: error instanceof Error ? error.message : "Calendar permission is required.",
      }
    }
  }
}
