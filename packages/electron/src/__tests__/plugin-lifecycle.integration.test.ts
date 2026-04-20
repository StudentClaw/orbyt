import { afterEach, beforeAll, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, rmSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { PluginManager } from "../plugins/plugin-manager.js"
import { PluginRegistry } from "../plugins/plugin-registry.js"

const repoRoot = path.resolve(import.meta.dir, "../../../..")
const bundledCatalogDir = path.resolve(repoRoot, "packages/extensions")
const tempDirs: string[] = []

function createTempDir(): string {
  const dir = path.join(tmpdir(), `student-claw-plugin-runtime-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  tempDirs.push(dir)
  return dir
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

beforeAll(() => {
  const extensionDir = path.resolve(repoRoot, "packages/extensions/template-mcp")
  const result = spawnSync("bun", ["--cwd", extensionDir, "build"], {
    cwd: repoRoot,
    encoding: "utf8",
  })

  if (result.status !== 0) {
    throw new Error(`Failed to build template-mcp for integration tests:\n${result.stderr || result.stdout}`)
  }

  if (!existsSync(path.join(extensionDir, "dist/index.js"))) {
    throw new Error("template-mcp build did not produce dist/index.js")
  }
}, 60_000)

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe("PluginManager integration", () => {
  test("spawns template-mcp, calls the canary tool, stops, and recovers from a crash", async () => {
    const registry = new PluginRegistry({
      bundledCatalogDir,
      userExtensionStoreDir: createTempDir(),
    })
    const manager = new PluginManager({
      registry,
      idleTimeoutMs: 60_000,
      retryDelaysMs: [0, 0, 0],
    })

    const started = await manager.start("template-mcp")
    expect(started).toEqual({
      ok: true,
      pluginId: "template-mcp",
      status: "active",
    })
    expect(manager.getStatus("template-mcp")).toMatchObject({
      kind: "available",
      status: "active",
    })

    const canary = await manager.callTool("template-mcp", "template_ping", {})
    expect(canary.isError).toBe(false)

    const pid = manager.getSandboxPid("template-mcp")
    expect(typeof pid).toBe("number")
    process.kill(pid!, "SIGKILL")

    await delay(150)
    expect(manager.getStatus("template-mcp")).toMatchObject({
      kind: "available",
      status: "error",
    })

    const retried = await manager.retry("template-mcp")
    expect(retried).toEqual({
      ok: true,
      pluginId: "template-mcp",
      status: "active",
    })

    const stopped = await manager.stop("template-mcp")
    expect(stopped).toEqual({
      ok: true,
      pluginId: "template-mcp",
      status: "stopped",
    })

    await manager.dispose()
  }, 60_000)
})
