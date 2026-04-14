import { Data } from "effect"

export class ExtensionManifestValidationError extends Data.TaggedError("ExtensionManifestValidationError")<{
  readonly message: string
  readonly pluginId?: string
  readonly issues: readonly string[]
}> {}

export class PluginStartError extends Data.TaggedError("PluginStartError")<{
  readonly message: string
  readonly pluginId: string
}> {}

export class PluginAuthError extends Data.TaggedError("PluginAuthError")<{
  readonly message: string
  readonly pluginId: string
}> {}

export class PluginRegistryMismatchError extends Data.TaggedError("PluginRegistryMismatchError")<{
  readonly message: string
  readonly pluginId: string
}> {}

export class PluginToolCallError extends Data.TaggedError("PluginToolCallError")<{
  readonly message: string
  readonly toolName: string
}> {}

export class VaultDecryptError extends Data.TaggedError("VaultDecryptError")<{
  readonly message: string
}> {}
