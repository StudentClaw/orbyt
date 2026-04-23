import {
  ExtensionManifest,
  parseExtensionManifestSync,
  type ExtensionManifest as CanvasManifest,
} from "@orbyt/contracts"
import { canvasStudentReplacementToolInventory } from "./student-tool-contract.js"

export const CanvasManifestSchema = ExtensionManifest

export type { CanvasManifest }

export const canvasManifest: CanvasManifest = parseExtensionManifestSync({
  id: "canvas-mcp",
  name: "Canvas Assistant",
  description: "Student-facing Canvas tools for assignments, grades, discussions, messages, and course content",
  version: "0.1.0",
  transport: {
    type: "local_stdio",
    entry: "dist/index.js",
  },
  permissions: ["assignments", "grades", "announcements", "modules", "pages", "files", "discussions", "messages"],
  auth: {
    type: "manual_token",
    instructions:
      "Generate a Canvas access token in Canvas under Settings > Approved Integrations > New Access Token.",
    fields: [
      {
        key: "baseUrl",
        label: "Canvas base URL",
        type: "base_url",
        required: true,
        placeholder: "https://myschool.instructure.com",
      },
      {
        key: "token",
        label: "Canvas access token",
        type: "secret",
        required: true,
        placeholder: "Paste your Canvas access token",
      },
    ],
  },
  tools: canvasStudentReplacementToolInventory.map(({ name, description }) => ({ name, description })),
  author: "orbyt",
  homepage: "https://github.com/Orbyt/orbyt",
})
