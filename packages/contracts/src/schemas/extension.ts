import { Schema } from "@effect/schema"
import { ExtensionManifestValidationError } from "../errors/plugin-errors.js"

export const ExtensionLifecycleStatus = Schema.Literal(
  "discovered",
  "disabled",
  "starting",
  "ready",
  "active",
  "stopping",
  "stopped",
  "error",
)
export type ExtensionLifecycleStatus = Schema.Schema.Type<typeof ExtensionLifecycleStatus>

export const ExtensionInstallSource = Schema.Literal("bundled", "user")
export type ExtensionInstallSource = Schema.Schema.Type<typeof ExtensionInstallSource>

export const ExtensionToolSummary = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
})
export type ExtensionToolSummary = Schema.Schema.Type<typeof ExtensionToolSummary>

export const ExtensionTransport = Schema.Struct({
  type: Schema.Literal("local_stdio"),
  entry: Schema.String,
})
export type ExtensionTransport = Schema.Schema.Type<typeof ExtensionTransport>

export const ExtensionAuthNoneSchema = Schema.Struct({
  type: Schema.Literal("none"),
})
export type ExtensionAuthNoneSchema = Schema.Schema.Type<typeof ExtensionAuthNoneSchema>

export const ExtensionAuthManualTokenSchema = Schema.Struct({
  type: Schema.Literal("manual_token"),
  instructions: Schema.String,
  requiredKeys: Schema.Array(Schema.String),
})
export type ExtensionAuthManualTokenSchema = Schema.Schema.Type<typeof ExtensionAuthManualTokenSchema>

export const ExtensionAuthSchema = Schema.Union(
  ExtensionAuthNoneSchema,
  ExtensionAuthManualTokenSchema,
)
export type ExtensionAuthSchema = Schema.Schema.Type<typeof ExtensionAuthSchema>

export const ExtensionManifest = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  version: Schema.String,
  transport: ExtensionTransport,
  permissions: Schema.Array(Schema.String),
  auth: ExtensionAuthSchema,
  tools: Schema.Array(ExtensionToolSummary),
  author: Schema.String,
  homepage: Schema.String,
})
export type ExtensionManifest = Schema.Schema.Type<typeof ExtensionManifest>

export const ExtensionRegistryEntry = Schema.Struct({
  manifest: ExtensionManifest,
  installSource: ExtensionInstallSource,
  status: ExtensionLifecycleStatus,
  enabled: Schema.Boolean,
  lastError: Schema.optional(Schema.String),
})
export type ExtensionRegistryEntry = Schema.Schema.Type<typeof ExtensionRegistryEntry>

// Backward-compatible alias for consumers that still import `Extension`.
export const Extension = ExtensionRegistryEntry
export type Extension = Schema.Schema.Type<typeof Extension>

function toIssueList(error: unknown): string[] {
  if (error instanceof Error) {
    return error.message.split("\n").map((line) => line.trim()).filter(Boolean)
  }

  return [String(error)]
}

export function parseExtensionManifestSync(input: unknown): ExtensionManifest {
  try {
    return Schema.decodeUnknownSync(ExtensionManifest)(input)
  } catch (error) {
    const candidate = typeof input === "object" && input !== null
      ? input as Partial<Record<"id", unknown>>
      : undefined

    throw new ExtensionManifestValidationError({
      message: "Extension manifest failed validation",
      pluginId: typeof candidate?.id === "string" ? candidate.id : undefined,
      issues: toIssueList(error),
    })
  }
}
