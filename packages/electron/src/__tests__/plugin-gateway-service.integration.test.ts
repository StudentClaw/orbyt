import { afterEach, beforeAll, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, rmSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import path from "node:path"
import { createPluginGatewayController } from "../plugins/plugin-gateway-service.js"
import { PluginManager } from "../plugins/plugin-manager.js"
import { PluginRegistry } from "../plugins/plugin-registry.js"

const repoRoot = path.resolve(import.meta.dir, "../../../..")
const bundledCatalogDir = path.resolve(repoRoot, "packages/extensions")
const tempDirs: string[] = []

function createTempDir(): string {
  const dir = path.join(tmpdir(), `orbyt-plugin-gateway-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  tempDirs.push(dir)
  return dir
}

beforeAll(() => {
  const extensionDir = path.resolve(repoRoot, "packages/extensions/template-mcp")
  const result = spawnSync("bun", ["--cwd", extensionDir, "build"], {
    cwd: repoRoot,
    encoding: "utf8",
  })

  if (result.status !== 0) {
    throw new Error(`Failed to build template-mcp for gateway integration tests:\n${result.stderr || result.stdout}`)
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

describe("plugin gateway service", () => {
  test("returns namespaced inventory and routes tool calls through the plugin manager", async () => {
    const registry = new PluginRegistry({
      bundledCatalogDir,
      userExtensionStoreDir: createTempDir(),
    })
    const manager = new PluginManager({
      registry,
      idleTimeoutMs: 60_000,
      retryDelaysMs: [0, 0, 0],
    })

    try {
      await manager.start("template-mcp")
      const gateway = createPluginGatewayController({
        runtime: manager,
      })

      expect(gateway.getSnapshot().tools).toEqual([
        expect.objectContaining({
          exposedToolName: "template.template_ping",
        }),
      ])

      const callResult = await gateway.routeToolCall({
        exposedToolName: "template.template_ping",
        args: {},
      })
      expect(callResult.ok).toBe(true)
      if (callResult.ok) {
        expect((callResult.result as { content?: Array<{ text?: string }> }).content?.[0]?.text).toBe("template-pong")
      }

      await manager.stop("template-mcp")
      await gateway.notifyToolInventoryChanged()

      expect(gateway.getSnapshot().tools).toEqual([])

      const stoppedCall = await gateway.routeToolCall({
        exposedToolName: "template.template_ping",
        args: {},
      })
      expect(stoppedCall).toMatchObject({
        ok: false,
        exposedToolName: "template.template_ping",
        reason: "plugin_not_running",
        pluginId: "template-mcp",
        rawToolName: "template_ping",
      })
      if (!stoppedCall.ok) {
        expect(stoppedCall.message).toMatch(/Plugin template-mcp is not running\.?/)
      }
    } finally {
      await manager.dispose()
    }
  }, 60_000)
})
