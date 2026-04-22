import { describe, expect, test } from "bun:test"
import { PluginRuntimeLogBuffer } from "../plugins/plugin-runtime-log-buffer.js"

describe("PluginRuntimeLogBuffer", () => {
  test("filters by plugin id and returns only the most recent entries up to the requested limit", () => {
    const buffer = new PluginRuntimeLogBuffer(3)

    buffer.addEntry({
      pluginId: "apple-calendar-mcp",
      source: "bridge",
      message: "bridge 1",
      emittedAt: "2026-04-20T18:00:00.000Z",
    })
    buffer.addEntry({
      pluginId: "canvas-mcp",
      source: "mcp",
      message: "canvas 1",
      emittedAt: "2026-04-20T18:01:00.000Z",
    })
    buffer.addEntry({
      pluginId: "apple-calendar-mcp",
      source: "mcp",
      message: "apple 2",
      emittedAt: "2026-04-20T18:02:00.000Z",
    })
    buffer.addEntry({
      pluginId: "apple-calendar-mcp",
      source: "bridge",
      message: "apple 3",
      emittedAt: "2026-04-20T18:03:00.000Z",
    })

    expect(buffer.getEntries()).toEqual([
      {
        pluginId: "canvas-mcp",
        source: "mcp",
        message: "canvas 1",
        emittedAt: "2026-04-20T18:01:00.000Z",
      },
      {
        pluginId: "apple-calendar-mcp",
        source: "mcp",
        message: "apple 2",
        emittedAt: "2026-04-20T18:02:00.000Z",
      },
      {
        pluginId: "apple-calendar-mcp",
        source: "bridge",
        message: "apple 3",
        emittedAt: "2026-04-20T18:03:00.000Z",
      },
    ])

    expect(buffer.getEntries({ pluginId: "apple-calendar-mcp", limit: 1 })).toEqual([
      {
        pluginId: "apple-calendar-mcp",
        source: "bridge",
        message: "apple 3",
        emittedAt: "2026-04-20T18:03:00.000Z",
      },
    ])
  })
})
