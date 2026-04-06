import { describe, test, expect, afterEach } from "bun:test"
import { Effect } from "effect"
import { ConfigService, ConfigServiceLive } from "../config/ConfigService.js"

describe("ConfigService", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test("loads defaults when no env vars set", async () => {
    delete process.env.PORT
    delete process.env.DB_PATH
    delete process.env.NODE_ENV

    const config = await Effect.runPromise(
      Effect.provide(ConfigService, ConfigServiceLive)
    )
    expect(config.port).toBe(8787)
    expect(config.dbPath).toBe("~/.student-claw/data.db")
    expect(config.isDev).toBe(true)
  })

  test("env vars override defaults", async () => {
    process.env.PORT = "9000"
    process.env.DB_PATH = "/tmp/test.db"
    process.env.NODE_ENV = "production"

    const config = await Effect.runPromise(
      Effect.provide(ConfigService, ConfigServiceLive)
    )
    expect(config.port).toBe(9000)
    expect(config.dbPath).toBe("/tmp/test.db")
    expect(config.isDev).toBe(false)
  })

  test("throws on invalid port", async () => {
    process.env.PORT = "not-a-number"

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
})
