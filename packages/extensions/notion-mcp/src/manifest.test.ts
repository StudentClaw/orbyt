import { describe, expect, test } from "bun:test"
import { parseExtensionManifestSync } from "@orbyt/contracts"
import manifestJson from "../manifest.json"
import { notionManifest, notionToolInventory } from "./manifest.js"

const officialLocalToolNames = [
  "API-get-user",
  "API-get-users",
  "API-get-self",
  "API-post-search",
  "API-get-block-children",
  "API-patch-block-children",
  "API-retrieve-a-block",
  "API-update-a-block",
  "API-delete-a-block",
  "API-retrieve-a-page",
  "API-patch-page",
  "API-post-page",
  "API-retrieve-a-page-property",
  "API-retrieve-a-comment",
  "API-create-a-comment",
  "API-query-data-source",
  "API-retrieve-a-data-source",
  "API-update-a-data-source",
  "API-create-a-data-source",
  "API-list-data-source-templates",
  "API-retrieve-a-database",
  "API-move-page",
] as const

describe("Notion MCP manifest", () => {
  test("locks the official local Notion MCP tool inventory", () => {
    expect(notionToolInventory.map((tool) => tool.name)).toEqual([...officialLocalToolNames])
    expect(notionManifest.tools.map((tool) => tool.name)).toEqual([...officialLocalToolNames])
  })

  test("keeps the packaged manifest aligned with the TypeScript manifest", () => {
    const parsed = parseExtensionManifestSync(manifestJson)

    expect(parsed).toEqual(notionManifest)
    expect(parsed.transport).toEqual({ type: "local_stdio", entry: "dist/index.js" })
    expect(parsed.auth).toEqual({
      type: "manual_token",
      instructions: expect.stringContaining("Notion internal integration"),
      fields: [
        {
          key: "NOTION_TOKEN",
          label: "Notion integration token",
          type: "secret",
          required: true,
          placeholder: "ntn_...",
        },
      ],
    })
  })
})
