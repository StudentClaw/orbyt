import { afterEach, describe, expect, test } from "bun:test"
import { EventEmitter } from "node:events"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import type { ChildProcess } from "node:child_process"
import { PassThrough } from "node:stream"
import {
  AppleCalendarBridgeManager,
  resolveAppleCalendarBridgeLaunch,
} from "../plugins/apple-calendar-bridge-manager.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-apple-bridge-"))
  tempDirs.push(dir)
  return dir
}

class FakeChild extends EventEmitter {
  pid = 4242
  killSignals: Array<NodeJS.Signals | number | undefined> = []
  stderr = new PassThrough()

  kill(signal?: NodeJS.Signals | number): boolean {
    this.killSignals.push(signal)
    this.emit("close", null, signal ?? null)
    return true
  }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe("AppleCalendarBridgeManager", () => {
  test("returns ready env after bridge health and permission probes succeed", async () => {
    const child = new FakeChild()
    const requests: Array<{ url: string; authorization: string | null }> = []
    const manager = new AppleCalendarBridgeManager({
      currentDir: "/repo/packages/electron/src",
      isPackaged: false,
      platform: "darwin",
      allocatePort: async () => 53412,
      createToken: () => "bridge-token",
      resolveLaunch: ({ port, token }) => {
        expect(port).toBe(53412)
        expect(token).toBe("bridge-token")
        return {
          command: "/usr/bin/swift",
          args: ["run", "CalendarAPIBridge"],
          cwd: "/repo/packages/extensions/apple-calendar-mcp/bridge",
          env: {},
        }
      },
      spawnProcess: () => child as unknown as ChildProcess,
      request: async (url, init) => {
        requests.push({
          url,
          authorization: new Headers(init?.headers).get("Authorization"),
        })
        return {
          ok: true,
          status: 200,
          text: async () => '{"success":true}',
        } as Response
      },
      reachableRetryDelaysMs: [0],
      sleep: async () => undefined,
    })

    const result = await manager.ensureReady()

    expect(result).toEqual({
      readiness: "ready",
      env: {
        MAC_API_BRIDGE_URL: "http://127.0.0.1:53412",
        MAC_API_BRIDGE_TOKEN: "bridge-token",
      },
    })
    expect(requests).toEqual([
      {
        url: "http://127.0.0.1:53412/health",
        authorization: "Bearer bridge-token",
      },
      {
        url: "http://127.0.0.1:53412/calendars",
        authorization: "Bearer bridge-token",
      },
    ])
  })

  test("returns permission_required when the bridge is healthy but calendar access is denied", async () => {
    const child = new FakeChild()
    let callCount = 0
    const manager = new AppleCalendarBridgeManager({
      currentDir: "/repo/packages/electron/src",
      isPackaged: false,
      platform: "darwin",
      allocatePort: async () => 53412,
      createToken: () => "bridge-token",
      resolveLaunch: () => ({
        command: "/usr/bin/swift",
        args: ["run", "CalendarAPIBridge"],
        cwd: "/repo/packages/extensions/apple-calendar-mcp/bridge",
        env: {},
      }),
      spawnProcess: () => child as unknown as ChildProcess,
      request: async () => {
        callCount += 1
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            text: async () => '{"success":true}',
          } as Response
        }

        return {
          ok: false,
          status: 500,
          text: async () => '{"error":"Calendar access was denied."}',
        } as Response
      },
      reachableRetryDelaysMs: [0],
      sleep: async () => undefined,
    })

    const result = await manager.ensureReady()

    expect(result).toEqual({
      readiness: "permission_required",
      lastError: "Calendar access was denied.",
    })
  })

  test("enters crash-loop readiness after repeated bridge exits", async () => {
    let now = new Date("2026-04-20T17:00:00.000Z")
    const manager = new AppleCalendarBridgeManager({
      currentDir: "/repo/packages/electron/src",
      isPackaged: false,
      platform: "darwin",
      now: () => now,
      allocatePort: async () => 53412,
      createToken: () => "bridge-token",
      resolveLaunch: () => ({
        command: "/usr/bin/swift",
        args: ["run", "CalendarAPIBridge"],
        cwd: "/repo/packages/extensions/apple-calendar-mcp/bridge",
        env: {},
      }),
      spawnProcess: () => {
        const child = new FakeChild()
        queueMicrotask(() => child.emit("close", 1, null))
        return child as unknown as ChildProcess
      },
      request: async () => {
        throw new Error("bridge unavailable")
      },
      reachableRetryDelaysMs: [0],
      sleep: async () => undefined,
      crashLoopThreshold: 3,
      crashLoopWindowMs: 60_000,
    })

    await expect(manager.ensureReady()).resolves.toMatchObject({ readiness: "bridge_unavailable" })
    now = new Date("2026-04-20T17:00:10.000Z")
    await expect(manager.ensureReady()).resolves.toMatchObject({ readiness: "bridge_unavailable" })
    now = new Date("2026-04-20T17:00:20.000Z")
    await expect(manager.ensureReady()).resolves.toMatchObject({ readiness: "bridge_crash_loop" })
  })

  test("stops the managed bridge process when asked", async () => {
    const child = new FakeChild()
    const manager = new AppleCalendarBridgeManager({
      currentDir: "/repo/packages/electron/src",
      isPackaged: false,
      platform: "darwin",
      allocatePort: async () => 53412,
      createToken: () => "bridge-token",
      resolveLaunch: () => ({
        command: "/usr/bin/swift",
        args: ["run", "CalendarAPIBridge"],
        cwd: "/repo/packages/extensions/apple-calendar-mcp/bridge",
        env: {},
      }),
      spawnProcess: () => child as unknown as ChildProcess,
      request: async () => ({
        ok: true,
        status: 200,
        text: async () => '{"success":true}',
      } as Response),
      reachableRetryDelaysMs: [0],
      sleep: async () => undefined,
    })

    await manager.ensureReady()
    await manager.stop()

    expect(child.killSignals).toEqual(["SIGTERM"])
  })

  test("resolves the vendored bridge launch config in development", () => {
    const launch = resolveAppleCalendarBridgeLaunch({
      currentDir: "/repo/packages/electron/src",
      isPackaged: false,
      port: 53412,
      token: "bridge-token",
    })

    expect(launch).toEqual({
      command: "/usr/bin/swift",
      args: ["run", "CalendarAPIBridge"],
      cwd: "/repo/packages/extensions/apple-calendar-mcp/bridge",
      env: {
        PORT: "53412",
        MAC_API_BRIDGE_TOKEN: "bridge-token",
        HOST: "127.0.0.1",
      },
    })
  })

  test("prefers an architecture-specific built bridge binary when Swift writes into .build/<triple>/release", () => {
    const repoRoot = createTempDir()
    const currentDir = path.join(repoRoot, "packages", "electron", "src")
    const archReleaseDir = path.join(
      repoRoot,
      "packages",
      "extensions",
      "apple-calendar-mcp",
      "bridge",
      ".build",
      "arm64-apple-macosx",
      "release",
    )
    mkdirSync(currentDir, { recursive: true })
    mkdirSync(archReleaseDir, { recursive: true })
    writeFileSync(path.join(archReleaseDir, "CalendarAPIBridge"), "binary")

    const launch = resolveAppleCalendarBridgeLaunch({
      currentDir,
      isPackaged: false,
      port: 53412,
      token: "bridge-token",
    })

    expect(launch).toEqual({
      command: path.join(archReleaseDir, "CalendarAPIBridge"),
      args: [],
      cwd: path.join(repoRoot, "packages", "extensions", "apple-calendar-mcp", "bridge"),
      env: {
        PORT: "53412",
        MAC_API_BRIDGE_TOKEN: "bridge-token",
        HOST: "127.0.0.1",
      },
    })
  })

  test("finds the vendored bridge from dist/main layouts in development", () => {
    const repoRoot = createTempDir()
    const currentDir = path.join(repoRoot, "packages", "electron", "dist", "main")
    const releaseDir = path.join(
      repoRoot,
      "packages",
      "extensions",
      "apple-calendar-mcp",
      "bridge",
      ".build",
      "release",
    )
    mkdirSync(currentDir, { recursive: true })
    mkdirSync(releaseDir, { recursive: true })
    writeFileSync(path.join(releaseDir, "CalendarAPIBridge"), "binary")

    const launch = resolveAppleCalendarBridgeLaunch({
      currentDir,
      isPackaged: false,
      port: 53412,
      token: "bridge-token",
    })

    expect(launch).toEqual({
      command: path.join(releaseDir, "CalendarAPIBridge"),
      args: [],
      cwd: path.join(repoRoot, "packages", "extensions", "apple-calendar-mcp", "bridge"),
      env: {
        PORT: "53412",
        MAC_API_BRIDGE_TOKEN: "bridge-token",
        HOST: "127.0.0.1",
      },
    })
  })

  test("resolves the packaged bridge launch config from staged resources", () => {
    const resourcesRoot = createTempDir()
    const bridgeRoot = path.join(resourcesRoot, "extensions", "apple-calendar-mcp", "bridge")
    mkdirSync(bridgeRoot, { recursive: true })
    writeFileSync(path.join(bridgeRoot, "CalendarAPIBridge"), "binary")

    const launch = resolveAppleCalendarBridgeLaunch({
      currentDir: "/repo/packages/electron/dist/main",
      isPackaged: true,
      resourcesPath: resourcesRoot,
      port: 53412,
      token: "bridge-token",
    })

    expect(launch).toEqual({
      command: path.join(bridgeRoot, "CalendarAPIBridge"),
      args: [],
      cwd: bridgeRoot,
      env: {
        PORT: "53412",
        MAC_API_BRIDGE_TOKEN: "bridge-token",
        HOST: "127.0.0.1",
      },
    })
  })

  test("surfaces a missing Swift runtime as bridge_unavailable instead of throwing", async () => {
    const child = new FakeChild()
    const manager = new AppleCalendarBridgeManager({
      currentDir: "/repo/packages/electron/src",
      isPackaged: false,
      platform: "darwin",
      allocatePort: async () => 53412,
      createToken: () => "bridge-token",
      resolveLaunch: () => ({
        command: "/usr/bin/swift",
        args: ["run", "CalendarAPIBridge"],
        cwd: "/repo/packages/extensions/apple-calendar-mcp/bridge",
        env: {},
      }),
      spawnProcess: () => {
        queueMicrotask(() => child.emit("error", new Error("spawn /usr/bin/swift ENOENT")))
        return child as unknown as ChildProcess
      },
      request: async () => {
        throw new Error("bridge unavailable")
      },
      reachableRetryDelaysMs: [0],
      sleep: async () => undefined,
    })

    await expect(manager.ensureReady()).resolves.toEqual({
      readiness: "bridge_unavailable",
      lastError: "Swift was not found for the Apple Calendar bridge. Install Xcode Command Line Tools or build the vendored bridge binary first.",
    })
  })

  test("surfaces a missing packaged bridge executable as bridge_unavailable instead of throwing", async () => {
    const child = new FakeChild()
    const resourcesRoot = createTempDir()
    const manager = new AppleCalendarBridgeManager({
      currentDir: "/repo/packages/electron/dist/main",
      isPackaged: true,
      resourcesPath: resourcesRoot,
      platform: "darwin",
      allocatePort: async () => 53412,
      createToken: () => "bridge-token",
      spawnProcess: (launch) => {
        queueMicrotask(() => child.emit("error", new Error(`spawn ${launch.command} ENOENT`)))
        return child as unknown as ChildProcess
      },
      request: async () => {
        throw new Error("bridge unavailable")
      },
      reachableRetryDelaysMs: [0],
      sleep: async () => undefined,
    })

    await expect(manager.ensureReady()).resolves.toEqual({
      readiness: "bridge_unavailable",
      lastError: `Apple Calendar bridge executable was not found: ${path.join(
        resourcesRoot,
        "extensions",
        "apple-calendar-mcp",
        "bridge",
        "CalendarAPIBridge",
      )}`,
    })
  })

  test("captures bridge stderr in the runtime log sink", async () => {
    const child = new FakeChild()
    const runtimeLogs: Array<{ pluginId: string; source: string; message: string }> = []
    const manager = new AppleCalendarBridgeManager({
      currentDir: "/repo/packages/electron/src",
      isPackaged: false,
      platform: "darwin",
      allocatePort: async () => 53412,
      createToken: () => "bridge-token",
      resolveLaunch: () => ({
        command: "/usr/bin/swift",
        args: ["run", "CalendarAPIBridge"],
        cwd: "/repo/packages/extensions/apple-calendar-mcp/bridge",
        env: {},
      }),
      spawnProcess: () => child as unknown as ChildProcess,
      request: async (url) => {
        if (String(url).endsWith("/health")) {
          child.stderr.write("bridge stderr line\n")
        }

        return {
          ok: true,
          status: 200,
          text: async () => '{"success":true}',
        } as Response
      },
      emitRuntimeLog: (entry) => {
        runtimeLogs.push({
          pluginId: entry.pluginId,
          source: entry.source,
          message: entry.message,
        })
      },
      reachableRetryDelaysMs: [0],
      sleep: async () => undefined,
    })

    await manager.ensureReady()

    expect(runtimeLogs).toEqual([
      {
        pluginId: "apple-calendar-mcp",
        source: "bridge",
        message: "bridge stderr line",
      },
    ])
  })
})
