import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import path from "node:path"
import * as electron from "electron"

type SafeStorageLike = {
  decryptString: (value: Buffer) => string
  encryptString: (value: string) => Buffer
  isEncryptionAvailable: () => boolean
}

type PluginVaultRecord = {
  pluginId: string
  encryptedPayload: string
  updatedAt: string
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object") {
    return false
  }

  return Object.values(value).every((entry) => typeof entry === "string")
}

export class PluginVault {
  constructor(
    private readonly rootDir: string,
    private readonly storage: SafeStorageLike = resolveSafeStorage(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  read(pluginId: string): Record<string, string> | null {
    const recordPath = this.getRecordPath(pluginId)
    if (!existsSync(recordPath)) {
      return null
    }

    this.assertEncryptionAvailable()

    const raw = JSON.parse(readFileSync(recordPath, "utf8")) as Partial<PluginVaultRecord>
    if (raw.pluginId !== pluginId || typeof raw.encryptedPayload !== "string") {
      throw new Error(`Stored credentials are malformed for ${pluginId}.`)
    }

    const decrypted = this.storage.decryptString(Buffer.from(raw.encryptedPayload, "base64"))
    const payload = JSON.parse(decrypted) as unknown
    if (!isStringRecord(payload)) {
      throw new Error(`Stored credentials are invalid for ${pluginId}.`)
    }

    return payload
  }

  write(pluginId: string, values: Record<string, string>): void {
    this.assertEncryptionAvailable()
    mkdirSync(this.rootDir, { recursive: true })

    const encryptedPayload = this.storage.encryptString(JSON.stringify(values)).toString("base64")
    const record: PluginVaultRecord = {
      pluginId,
      encryptedPayload,
      updatedAt: this.now().toISOString(),
    }

    writeFileSync(this.getRecordPath(pluginId), JSON.stringify(record, null, 2), "utf8")
  }

  clear(pluginId: string): void {
    const recordPath = this.getRecordPath(pluginId)
    if (existsSync(recordPath)) {
      unlinkSync(recordPath)
    }
  }

  private getRecordPath(pluginId: string): string {
    return path.join(this.rootDir, `${pluginId}.json`)
  }

  private assertEncryptionAvailable(): void {
    if (!this.storage.isEncryptionAvailable()) {
      throw new Error("Electron safeStorage is unavailable.")
    }
  }
}

export function resolvePluginVaultDir(userDataPath: string): string {
  return path.join(userDataPath, "plugin-vault")
}

function resolveSafeStorage(): SafeStorageLike {
  const storage = (electron as { safeStorage?: SafeStorageLike }).safeStorage
  if (!storage) {
    return {
      isEncryptionAvailable: () => false,
      encryptString: () => {
        throw new Error("Electron safeStorage is unavailable.")
      },
      decryptString: () => {
        throw new Error("Electron safeStorage is unavailable.")
      },
    }
  }

  return storage
}
