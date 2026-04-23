import type { ExtensionRuntimeReadiness } from "@orbyt/contracts"

export type PluginRuntimePreparation =
  | {
    readiness: "ready"
    env?: Record<string, string>
  }
  | {
    readiness: Exclude<ExtensionRuntimeReadiness, "ready">
    lastError: string
    env?: Record<string, string>
  }
