import { describe, test, expect } from "bun:test"
import {
  CanvasAuthError,
  CanvasApiError,
  CodexSpawnError,
  CodexTimeoutError,
  ExtensionManifestValidationError,
  PluginAuthError,
  PluginRegistryMismatchError,
  PluginStartError,
  PluginToolCallError,
  VaultDecryptError,
  MemoryWriteError,
  SchemaDecodeError,
  JsonRpcParseError,
  PolicyDeniedError,
} from "../errors/index.js"

describe("Canvas errors", () => {
  test("CanvasAuthError has correct _tag", () => {
    const err = new CanvasAuthError({ message: "Token expired" })
    expect(err._tag).toBe("CanvasAuthError")
    expect(err.message).toBe("Token expired")
  })

  test("CanvasApiError has correct _tag and statusCode", () => {
    const err = new CanvasApiError({ message: "Not found", statusCode: 404 })
    expect(err._tag).toBe("CanvasApiError")
    expect(err.statusCode).toBe(404)
  })
})

describe("AI errors", () => {
  test("CodexSpawnError has correct _tag", () => {
    const err = new CodexSpawnError({ message: "Failed to spawn" })
    expect(err._tag).toBe("CodexSpawnError")
    expect(err.message).toBe("Failed to spawn")
  })

  test("CodexTimeoutError has correct _tag and timeoutMs", () => {
    const err = new CodexTimeoutError({ message: "Timed out", timeoutMs: 30000 })
    expect(err._tag).toBe("CodexTimeoutError")
    expect(err.timeoutMs).toBe(30000)
  })
})

describe("Plugin errors", () => {
  test("ExtensionManifestValidationError has correct _tag and issues", () => {
    const err = new ExtensionManifestValidationError({
      message: "Manifest invalid",
      pluginId: "canvas-mcp",
      issues: ["transport.type must be local_stdio"],
    })
    expect(err._tag).toBe("ExtensionManifestValidationError")
    expect(err.issues).toEqual(["transport.type must be local_stdio"])
  })

  test("PluginStartError has correct _tag and pluginId", () => {
    const err = new PluginStartError({ message: "Start failed", pluginId: "canvas-mcp" })
    expect(err._tag).toBe("PluginStartError")
    expect(err.pluginId).toBe("canvas-mcp")
  })

  test("PluginAuthError has correct _tag and pluginId", () => {
    const err = new PluginAuthError({ message: "Auth failed", pluginId: "canvas-mcp" })
    expect(err._tag).toBe("PluginAuthError")
    expect(err.pluginId).toBe("canvas-mcp")
  })

  test("PluginRegistryMismatchError has correct _tag and pluginId", () => {
    const err = new PluginRegistryMismatchError({ message: "Registry mismatch", pluginId: "canvas-mcp" })
    expect(err._tag).toBe("PluginRegistryMismatchError")
    expect(err.pluginId).toBe("canvas-mcp")
  })

  test("PluginToolCallError has correct _tag and toolName", () => {
    const err = new PluginToolCallError({ message: "Tool failed", toolName: "search" })
    expect(err._tag).toBe("PluginToolCallError")
    expect(err.toolName).toBe("search")
  })

  test("VaultDecryptError has correct _tag", () => {
    const err = new VaultDecryptError({ message: "Decrypt failed" })
    expect(err._tag).toBe("VaultDecryptError")
  })
})

describe("Memory errors", () => {
  test("MemoryWriteError has correct _tag", () => {
    const err = new MemoryWriteError({ message: "Write failed" })
    expect(err._tag).toBe("MemoryWriteError")
  })
})

describe("Schema errors", () => {
  test("SchemaDecodeError has correct _tag", () => {
    const err = new SchemaDecodeError({ message: "Decode failed" })
    expect(err._tag).toBe("SchemaDecodeError")
  })

  test("JsonRpcParseError has correct _tag", () => {
    const err = new JsonRpcParseError({ message: "Parse failed" })
    expect(err._tag).toBe("JsonRpcParseError")
  })

  test("PolicyDeniedError has correct _tag and capability", () => {
    const err = new PolicyDeniedError({ message: "Denied", capability: "canvas.write" })
    expect(err._tag).toBe("PolicyDeniedError")
    expect(err.capability).toBe("canvas.write")
  })
})

describe("Error discrimination", () => {
  test("all errors have unique _tag values", () => {
    const errors = [
      new CanvasAuthError({ message: "" }),
      new CanvasApiError({ message: "", statusCode: 0 }),
      new CodexSpawnError({ message: "" }),
      new CodexTimeoutError({ message: "", timeoutMs: 0 }),
      new ExtensionManifestValidationError({ message: "", issues: [] }),
      new PluginStartError({ message: "", pluginId: "" }),
      new PluginAuthError({ message: "", pluginId: "" }),
      new PluginRegistryMismatchError({ message: "", pluginId: "" }),
      new PluginToolCallError({ message: "", toolName: "" }),
      new VaultDecryptError({ message: "" }),
      new MemoryWriteError({ message: "" }),
      new SchemaDecodeError({ message: "" }),
      new JsonRpcParseError({ message: "" }),
      new PolicyDeniedError({ message: "", capability: "" }),
    ]
    const tags = errors.map((e) => e._tag)
    const uniqueTags = new Set(tags)
    expect(uniqueTags.size).toBe(tags.length)
  })
})
