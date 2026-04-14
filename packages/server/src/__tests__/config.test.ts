import { describe, test, expect, afterEach } from "bun:test"
import { Effect } from "effect"
import {
  ConfigService,
  ConfigServiceLive,
  resolveCodexBinaryPath,
} from "../config/ConfigService.js"

describe("ConfigService", () => {
  const originalEnv = { ...process.env }
  const authToken = "a".repeat(64)

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test("loads defaults when no env vars set", async () => {
    delete process.env.PORT
    delete process.env.DB_PATH
    delete process.env.NODE_ENV
    process.env.WS_AUTH_TOKEN = authToken

    const config = await Effect.runPromise(
      Effect.provide(ConfigService, ConfigServiceLive)
    )
    expect(config.port).toBe(8787)
    expect(config.wsHost).toBe("127.0.0.1")
    expect(config.wsAuthToken).toBe(authToken)
    expect(config.dbPath).toBe("~/.student-claw/data.db")
    expect(config.isDev).toBe(true)
  })

  test("env vars override defaults", async () => {
    process.env.PORT = "9000"
    process.env.DB_PATH = "/tmp/test.db"
    process.env.NODE_ENV = "production"
    process.env.CODEX_BINARY_PATH = "/tmp/custom-codex"
    process.env.WS_AUTH_TOKEN = authToken

    const config = await Effect.runPromise(
      Effect.provide(ConfigService, ConfigServiceLive)
    )
    expect(config.port).toBe(9000)
    expect(config.wsAuthToken).toBe(authToken)
    expect(config.dbPath).toBe("/tmp/test.db")
    expect(config.isDev).toBe(false)
    expect(config.codexBinaryPath).toBe("/tmp/custom-codex")
  })

  test("throws on invalid port", async () => {
    process.env.PORT = "not-a-number"
    process.env.WS_AUTH_TOKEN = authToken

    let threw = false
    try {
      await Effect.runPromise(
        Effect.provide(ConfigService, ConfigServiceLive)
      )
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
  })

  test("prefers the installed codex desktop binary on macOS when present", () => {
    const resolved = resolveCodexBinaryPath({
      env: {},
      platform: "darwin",
      hasPath: (path) => path === "/Applications/Codex.app/Contents/Resources/codex",
    })

    expect(resolved).toBe("/Applications/Codex.app/Contents/Resources/codex")
  })

  test("falls back to plain codex when no explicit binary path is available", () => {
    const resolved = resolveCodexBinaryPath({
      env: {},
      platform: "linux",
      hasPath: () => false,
    })

    expect(resolved).toBe("codex")
  })

  test("throws on missing auth token", async () => {
    delete process.env.WS_AUTH_TOKEN

    await expect(
      Effect.runPromise(
        Effect.provide(ConfigService, ConfigServiceLive)
      )
    ).rejects.toThrow("WS_AUTH_TOKEN")
  })
})
