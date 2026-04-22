import { describe, expect, test } from "bun:test"
import { Schema } from "@effect/schema"
import {
  ExtensionAuthSchema,
  ExtensionInstallSource,
  ExtensionLifecycleStatus,
  ExtensionManifest,
  ExtensionRegistryEntry,
  ExtensionManifestValidationError,
  ExtensionRuntimeReadiness,
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
  tools: [
    { name: "list_courses", description: "List Canvas courses visible to the authenticated student." },
    { name: "get_my_upcoming_assignments", description: "List upcoming assignments across the student's active Canvas courses." },
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

  test("transport schema accepts runtime-injected env values", () => {
    const parsed = Schema.decodeUnknownSync(ExtensionTransport)({
      type: "local_stdio",
      entry: "dist/index.js",
      env: {
        MAC_API_BRIDGE_URL: "http://127.0.0.1:53412",
        MAC_API_BRIDGE_TOKEN: "token-123",
      },
    })

    expect(parsed.env?.MAC_API_BRIDGE_URL).toBe("http://127.0.0.1:53412")
    expect(parsed.env?.MAC_API_BRIDGE_TOKEN).toBe("token-123")
  })

  test("lifecycle status rejects invalid values", () => {
    expect(() => Schema.decodeUnknownSync(ExtensionLifecycleStatus)("inactive")).toThrow()
  })

  test("runtime readiness accepts the locked bridge-aware states", () => {
    const decode = Schema.decodeUnknownSync(ExtensionRuntimeReadiness)

    expect(decode("ready")).toBe("ready")
    expect(decode("bridge_starting")).toBe("bridge_starting")
    expect(decode("bridge_unavailable")).toBe("bridge_unavailable")
    expect(decode("permission_required")).toBe("permission_required")
    expect(decode("bridge_crash_loop")).toBe("bridge_crash_loop")
    expect(decode("platform_unsupported")).toBe("platform_unsupported")
    expect(decode("error")).toBe("error")
  })

  test("runtime readiness rejects invalid states", () => {
    expect(() => Schema.decodeUnknownSync(ExtensionRuntimeReadiness)("disabled")).toThrow()
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
        fields: [],
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
      readiness: "permission_required",
    })
    expect(available.kind).toBe("available")
    expect(available.readiness).toBe("permission_required")

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
