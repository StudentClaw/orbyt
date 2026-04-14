import { describe, expect, test } from "bun:test"
import type { ExtensionRegistryEntry } from "@student-claw/contracts"
import {
  createGatewayInventorySnapshot,
  formatGatewayNamespace,
  formatGatewayToolName,
  mapGatewayInventory,
} from "../plugins/plugin-gateway-inventory.js"

const availableEntry: Extract<ExtensionRegistryEntry, { kind: "available" }> = {
  kind: "available",
  manifest: {
    id: "template-mcp",
    name: "Template MCP",
    description: "Template extension",
    version: "0.1.0",
    transport: {
      type: "local_stdio",
      entry: "dist/index.js",
    },
    permissions: ["template"],
    auth: {
      type: "none",
    },
    tools: [{ name: "template_ping", description: "Ping" }],
    author: "student-claw",
    homepage: "https://github.com/StudentClaw/student-claw",
  },
  installSource: "bundled",
  status: "active",
  enabled: true,
}

describe("plugin gateway inventory", () => {
  test("formats the stable namespace and exposed tool name", () => {
    expect(formatGatewayNamespace("template-mcp")).toBe("template")
    expect(formatGatewayToolName("template-mcp", "template_ping")).toBe("template.template_ping")
  })

  test("includes only available running plugins in the mapped inventory", () => {
    const readyEntry: ExtensionRegistryEntry = {
      ...availableEntry,
      manifest: {
        ...availableEntry.manifest,
        id: "ready-plugin-mcp",
        tools: [{ name: "ready_ping", description: "Ready ping" }],
      },
      status: "ready",
    }
    const stoppedEntry: ExtensionRegistryEntry = {
      ...availableEntry,
      manifest: {
        ...availableEntry.manifest,
        id: "stopped-plugin-mcp",
        tools: [{ name: "stopped_ping", description: "Stopped ping" }],
      },
      status: "stopped",
    }
    const disabledEntry: ExtensionRegistryEntry = {
      ...availableEntry,
      manifest: {
        ...availableEntry.manifest,
        id: "disabled-plugin-mcp",
        tools: [{ name: "disabled_ping", description: "Disabled ping" }],
      },
      enabled: false,
    }
    const invalidEntry: Extract<ExtensionRegistryEntry, { kind: "invalid" }> = {
      kind: "invalid",
      pluginId: "broken-plugin",
      displayName: "Broken Plugin",
      installSource: "user",
      status: "error",
      enabled: false,
      lastError: "manifest invalid",
      manifestPath: "/tmp/broken/manifest.json",
    }

    const mapped = mapGatewayInventory([
      availableEntry,
      readyEntry,
      stoppedEntry,
      disabledEntry,
      invalidEntry,
    ])

    expect(mapped).toEqual([
      {
        exposedToolName: "template.template_ping",
        description: "Ping",
        pluginId: "template-mcp",
        rawToolName: "template_ping",
      },
      {
        exposedToolName: "ready_plugin.ready_ping",
        description: "Ready ping",
        pluginId: "ready-plugin-mcp",
        rawToolName: "ready_ping",
      },
    ])

    const snapshot = createGatewayInventorySnapshot([availableEntry, stoppedEntry], 7, "2026-04-11T00:00:00.000Z")
    expect(snapshot).toEqual({
      revision: 7,
      observedAt: "2026-04-11T00:00:00.000Z",
      tools: [
        {
          exposedToolName: "template.template_ping",
          description: "Ping",
          pluginId: "template-mcp",
          rawToolName: "template_ping",
        },
      ],
    })
  })
})
