import { describe, expect, test } from "bun:test"
import type { ExtensionRegistryEntry } from "@orbyt/contracts"
import { prepareNotionMcpRuntime } from "../plugins/plugin-runtime.js"

const notionEntry: Extract<ExtensionRegistryEntry, { kind: "available" }> = {
  kind: "available",
  manifest: {
    id: "notion-mcp",
    name: "Notion",
    description: "Notion extension",
    version: "0.1.0",
    transport: {
      type: "local_stdio",
      entry: "dist/index.js",
    },
    permissions: ["notion.workspace.read", "notion.content.write"],
    auth: {
      type: "manual_token",
      instructions: "Paste your Notion integration token.",
      fields: [
        {
          key: "NOTION_TOKEN",
          label: "Notion integration token",
          type: "secret",
          required: true,
          placeholder: "ntn_...",
        },
      ],
    },
    tools: [{ name: "API-post-search", description: "Search Notion" }],
    author: "orbyt",
    homepage: "https://github.com/makenotion/notion-mcp-server",
  },
  installSource: "bundled",
  status: "discovered",
  enabled: true,
}

describe("plugin runtime preparation", () => {
  test("injects saved Notion credentials as scoped pre-spawn env", () => {
    const result = prepareNotionMcpRuntime({
      entry: notionEntry,
      manifestPath: "/tmp/notion-mcp/manifest.json",
    }, {
      getCredentialEnvironment: () => ({
        NOTION_TOKEN: "ntn_12345678901234567890",
      }),
    })

    expect(result).toEqual({
      readiness: "ready",
      env: {
        NOTION_TOKEN: "ntn_12345678901234567890",
      },
    })
  })

  test("withholds Notion startup until credentials are configured", () => {
    const result = prepareNotionMcpRuntime({
      entry: notionEntry,
      manifestPath: "/tmp/notion-mcp/manifest.json",
    }, {
      getCredentialEnvironment: () => null,
    })

    expect(result).toEqual({
      readiness: "error",
      lastError: "Notion credentials are not configured. Save a Notion integration token in Settings > Connections.",
    })
  })
})
