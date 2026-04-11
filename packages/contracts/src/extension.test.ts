import { describe, expect, test } from "bun:test"
import { Schema } from "@effect/schema"
import {
  ExtensionAuthSchema,
  ExtensionInstallSource,
  ExtensionLifecycleStatus,
  ExtensionManifest,
  ExtensionRegistryEntry,
  ExtensionManifestValidationError,
  ExtensionTransport,
  parseExtensionManifestSync,
} from "./index.js"

const validManifest = {
  id: "canvas-mcp",
  name: "Canvas Assistant",
  description: "Connects to Canvas coursework, grades, announcements, modules, and pages",
  version: "0.1.0",
  transport: {
    type: "local_stdio",
    entry: "dist/index.js",
  },
  permissions: ["assignments", "grades", "announcements", "modules", "pages"],
  auth: {
    type: "manual_token",
    instructions: "Generate a Canvas access token in Canvas under Settings > Approved Integrations > New Access Token.",
    requiredKeys: ["CANVAS_TOKEN", "CANVAS_BASE_URL"],
  },
  tools: [
    { name: "get_courses", description: "List Canvas courses available to the student." },
    { name: "get_coursework", description: "List coursework items across Canvas courses." },
  ],
  author: "student-claw",
  homepage: "https://github.com/StudentClaw/student-claw",
} as const

describe("Extension contracts", () => {
  test("manifest schema accepts a valid bundled manifest", () => {
    const parsed = Schema.decodeUnknownSync(ExtensionManifest)(validManifest)
    expect(parsed.id).toBe("canvas-mcp")
    expect(parsed.transport.type).toBe("local_stdio")
  })

  test("transport schema rejects invalid transport type", () => {
    expect(() =>
      Schema.decodeUnknownSync(ExtensionTransport)({
        type: "remote_http",
        entry: "https://example.com/mcp",
      })
    ).toThrow()
  })

  test("lifecycle status rejects invalid values", () => {
    expect(() => Schema.decodeUnknownSync(ExtensionLifecycleStatus)("inactive")).toThrow()
  })

  test("install source accepts system provenance", () => {
    const parsed = Schema.decodeUnknownSync(ExtensionInstallSource)("system")
    expect(parsed).toBe("system")
  })

  test("auth schema rejects invalid payloads", () => {
    expect(() =>
      Schema.decodeUnknownSync(ExtensionAuthSchema)({
        type: "manual_token",
        instructions: "Paste a token",
      })
    ).toThrow()
  })

  test("malformed manifests map to typed validation errors", () => {
    expect(() =>
      parseExtensionManifestSync({
        ...validManifest,
        transport: {
          type: "bad_transport",
          entry: "dist/index.js",
        },
      })
    ).toThrow(ExtensionManifestValidationError)
  })

  test("registry entries support available and invalid rows", () => {
    const decode = Schema.decodeUnknownSync(ExtensionRegistryEntry)

    const available = decode({
      kind: "available",
      manifest: validManifest,
      installSource: "bundled",
      status: "discovered",
      enabled: true,
    })
    expect(available.kind).toBe("available")

    const invalid = decode({
      kind: "invalid",
      pluginId: "broken-plugin",
      displayName: "Broken Plugin",
      installSource: "user",
      status: "error",
      enabled: false,
      lastError: "manifest invalid",
      manifestPath: "/tmp/broken/manifest.json",
    })
    expect(invalid.kind).toBe("invalid")
  })
})
