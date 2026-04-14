import { afterEach, beforeAll, describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { existsSync, mkdirSync, rmSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import type { AppConfig } from "../config/defaults.js"
import { defaultConfig } from "../config/defaults.js"
import { ConfigService } from "../config/ConfigService.js"
import { PluginGateway, PluginGatewayLive } from "../mcp/PluginGateway.js"

const repoRoot = path.resolve(import.meta.dir, "../../../..")
const bundledCatalogDir = path.resolve(repoRoot, "packages/extensions")
const tempDirs: string[] = []

function createTempDir(): string {
  const dir = path.join(tmpdir(), `student-claw-server-plugin-gateway-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  tempDirs.push(dir)
  return dir
}

async function loadPluginGateway(config: AppConfig) {
  return Effect.runPromise(
    Effect.gen(function* () {
      return yield* PluginGateway
    }).pipe(
      Effect.provide(
        PluginGatewayLive.pipe(
          Layer.provide(Layer.succeed(ConfigService, config)),
        ),
      ),
    ),
  )
}

async function loadElectronPluginModules(): Promise<{
  readonly createPluginGatewayController: (...args: any[]) => any
  readonly PluginManager: new (...args: any[]) => any
  readonly PluginRegistry: new (...args: any[]) => any
}> {
  const pluginsDir = path.resolve(import.meta.dir, "../../../electron/src/plugins")
  const [{ createPluginGatewayController }, { PluginManager }, { PluginRegistry }] = await Promise.all([
    import(pathToFileURL(path.join(pluginsDir, "plugin-gateway-service.ts")).href),
    import(pathToFileURL(path.join(pluginsDir, "plugin-manager.ts")).href),
    import(pathToFileURL(path.join(pluginsDir, "plugin-registry.ts")).href),
  ])

  return {
    createPluginGatewayController,
    PluginManager,
    PluginRegistry,
  }
}

beforeAll(() => {
  const extensionDir = path.resolve(repoRoot, "packages/extensions/template-mcp")
  const result = spawnSync("bun", ["--cwd", extensionDir, "build"], {
    cwd: repoRoot,
    encoding: "utf8",
  })

  if (result.status !== 0) {
    throw new Error(`Failed to build template-mcp for server gateway tests:\n${result.stderr || result.stdout}`)
  }

  if (!existsSync(path.join(extensionDir, "dist/index.js"))) {
    throw new Error("template-mcp build did not produce dist/index.js")
  }
})

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe("server PluginGateway", () => {
  test("calls the Main bridge end to end with the exposed gateway tool name", async () => {
    const { createPluginGatewayController, PluginManager, PluginRegistry } = await loadElectronPluginModules()
    const registry = new PluginRegistry({
      bundledCatalogDir,
      userExtensionStoreDir: createTempDir(),
    })
    const manager = new PluginManager({
      registry,
      idleTimeoutMs: 60_000,
      retryDelaysMs: [0, 0, 0],
    })
    let gateway: Awaited<ReturnType<typeof loadPluginGateway>> | null = null
    const originalFetch = globalThis.fetch

    try {
      await manager.start("template-mcp")
      const bridge = createPluginGatewayController({
        runtime: manager,
      })

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url

        if (url.endsWith("/tool-inventory")) {
          return new Response(JSON.stringify({
            snapshot: bridge.getSnapshot(),
          }), {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          })
        }

        if (url.endsWith("/call-tool")) {
          const body = typeof init?.body === "string" ? init.body : "{}"
          const result = await bridge.routeToolCall(JSON.parse(body))
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          })
        }

        if (url.endsWith("/events")) {
          return new Response(new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`))
            },
          }), {
            status: 200,
            headers: {
              "content-type": "text/event-stream",
            },
          })
        }

        throw new Error(`Unexpected fetch in plugin gateway test: ${url}`)
      }) as typeof globalThis.fetch

      gateway = await loadPluginGateway({
        ...defaultConfig,
        wsAuthToken: "a".repeat(64),
        pluginGatewayBridgeUrl: "http://plugin-gateway.test/bridge",
        pluginGatewayBridgeEventsUrl: "http://plugin-gateway.test/events",
        pluginGatewayBridgeToken: "test-bridge-token",
      })

      const inventory = await gateway.getInventory()
      expect(inventory.tools).toEqual([
        expect.objectContaining({
          exposedToolName: "template.template_ping",
          pluginId: "template-mcp",
          rawToolName: "template_ping",
        }),
      ])

      const success = await gateway.callTool("template.template_ping", {})
      expect(success).toMatchObject({
        ok: true,
        exposedToolName: "template.template_ping",
        pluginId: "template-mcp",
        rawToolName: "template_ping",
      })
      if (success.ok) {
        expect((success.result as { content?: Array<{ text?: string }> }).content?.[0]?.text).toBe("template-pong")
      }

      await manager.stop("template-mcp")

      const failure = await gateway.callTool("template.template_ping", {})
      expect(failure).toMatchObject({
        ok: false,
        exposedToolName: "template.template_ping",
        reason: "plugin_not_running",
        pluginId: "template-mcp",
        rawToolName: "template_ping",
      })
      expect(failure.ok).toBe(false)
      if (!failure.ok) {
        expect(failure.message).toMatch(/Plugin template-mcp is not running\.?/)
      }
    } finally {
      globalThis.fetch = originalFetch
      await gateway?.dispose()
      await manager.dispose()
    }
  })
})
