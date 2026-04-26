import type {
  ExtensionAuthField,
  ExtensionAuthManualTokenSchema,
  ExtensionRegistryAvailableEntry,
  PluginAuthStatus,
  PluginSaveAuthParams,
  PluginSaveAuthResult,
} from "@orbyt/contracts"
import { PluginVault } from "./plugin-vault.js"

const MIN_SECRET_LENGTH = 20

type PluginRegistrySource = Pick<
  import("./plugin-registry.js").PluginRegistry,
  "getAvailableRecord" | "getStatus"
>

type ManualTokenRegistryRecord = {
  entry: ExtensionRegistryAvailableEntry & {
    manifest: ExtensionRegistryAvailableEntry["manifest"] & {
      auth: ExtensionAuthManualTokenSchema
    }
  }
  manifestPath: string
}

type ValidationResult =
  | {
    ok: true
    values: Record<string, string>
  }
  | {
    ok: false
    error: string
    fieldErrors: Record<string, string>
  }

type PluginCredentialMessage = {
  type: "plugin.credentials"
  pluginId: string
  payload: Record<string, string>
}

export class PluginAuthService {
  constructor(
    private readonly options: {
      registry: PluginRegistrySource
      vault: PluginVault
    },
  ) {}

  getStatus(pluginId: string): PluginAuthStatus | null {
    const record = this.getManualTokenRecord(pluginId)
    if (!record) {
      return this.options.registry.getStatus(pluginId) ? {
        pluginId,
        status: "error",
        error: `Plugin ${pluginId} does not support manual credentials.`,
      } : null
    }

    try {
      const stored = this.options.vault.read(pluginId)
      if (!stored) {
        return {
          pluginId,
          status: "not_configured",
        }
      }

      const validation = validateCredentialValues(record.entry.manifest.auth.fields, stored)
      if (!validation.ok) {
        return {
          pluginId,
          status: "error",
          error: validation.error,
        }
      }

      return {
        pluginId,
        status: "configured",
      }
    } catch (error) {
      return {
        pluginId,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  saveCredentials(params: PluginSaveAuthParams): PluginSaveAuthResult {
    const record = this.getManualTokenRecord(params.pluginId)
    if (!record) {
      if (!this.options.registry.getStatus(params.pluginId)) {
        return {
          ok: false,
          pluginId: params.pluginId,
          reason: "plugin_not_found",
          error: `Plugin ${params.pluginId} was not found.`,
        }
      }

      return {
        ok: false,
        pluginId: params.pluginId,
        reason: "unsupported_auth_type",
        error: `Plugin ${params.pluginId} does not support manual credentials.`,
      }
    }

    const validation = validateCredentialValues(record.entry.manifest.auth.fields, params.values)
    if (!validation.ok) {
      return {
        ok: false,
        pluginId: params.pluginId,
        reason: "validation_failed",
        error: validation.error,
        fieldErrors: validation.fieldErrors,
      }
    }

    try {
      this.options.vault.write(params.pluginId, validation.values)
      return {
        ok: true,
        pluginId: params.pluginId,
        status: "configured",
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        pluginId: params.pluginId,
        reason: message.includes("safeStorage is unavailable") ? "storage_unavailable" : "save_failed",
        error: message,
      }
    }
  }

  clearCredentials(pluginId: string): void {
    this.options.vault.clear(pluginId)
  }

  getCredentialMessage(pluginId: string): PluginCredentialMessage | null {
    const record = this.getManualTokenRecord(pluginId)
    if (!record) {
      return null
    }

    try {
      const stored = this.options.vault.read(pluginId)
      if (!stored) {
        return null
      }

      const validation = validateCredentialValues(record.entry.manifest.auth.fields, stored)
      if (!validation.ok) {
        return null
      }

      return {
        type: "plugin.credentials",
        pluginId,
        payload: validation.values,
      }
    } catch {
      return null
    }
  }

  private getManualTokenRecord(pluginId: string): ManualTokenRegistryRecord | null {
    const record = this.options.registry.getAvailableRecord(pluginId)
    if (!record || record.entry.manifest.auth.type !== "manual_token") {
      return null
    }

    return record as ManualTokenRegistryRecord
  }
}

function validateCredentialValues(
  fields: readonly ExtensionAuthField[],
  values: Record<string, string>,
): ValidationResult {
  const normalized: Record<string, string> = {}
  const fieldErrors: Record<string, string> = {}

  for (const field of fields) {
    const value = (values[field.key] ?? "").trim()
    normalized[field.key] = value

    if (field.required && value.length === 0) {
      fieldErrors[field.key] = `${field.label} is required.`
      continue
    }

    if (value.length === 0) {
      continue
    }

    if (field.type === "base_url" && !isValidCanvasBaseUrl(value)) {
      fieldErrors[field.key] = "Enter a valid HTTPS Canvas URL."
      continue
    }

    if (field.type === "secret" && value.length < MIN_SECRET_LENGTH) {
      fieldErrors[field.key] = `Enter at least ${MIN_SECRET_LENGTH} characters.`
      continue
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Credentials are incomplete or invalid.",
      fieldErrors,
    }
  }

  return {
    ok: true,
    values: normalized,
  }
}
function isValidCanvasBaseUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname.length > 0
  } catch {
    return false
  }
}
