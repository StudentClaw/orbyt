import type { DesktopUpdateMode } from "@orbyt/contracts"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

export type DesktopUpdateSettings = {
  readonly mode: DesktopUpdateMode
}

const DEFAULT_SETTINGS: DesktopUpdateSettings = {
  mode: "automatic",
}

function isDesktopUpdateMode(value: unknown): value is DesktopUpdateMode {
  return value === "automatic" || value === "prompt"
}

function normalizeSettings(value: unknown): DesktopUpdateSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_SETTINGS
  }

  const mode = (value as { mode?: unknown }).mode
  return {
    mode: isDesktopUpdateMode(mode) ? mode : DEFAULT_SETTINGS.mode,
  }
}

export class DesktopUpdateSettingsStore {
  private readonly filePath: string

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "desktop-update-settings.json")
  }

  read(): DesktopUpdateSettings {
    if (!existsSync(this.filePath)) {
      return DEFAULT_SETTINGS
    }

    try {
      return normalizeSettings(JSON.parse(readFileSync(this.filePath, "utf8")))
    } catch {
      return DEFAULT_SETTINGS
    }
  }

  write(settings: DesktopUpdateSettings): DesktopUpdateSettings {
    const normalized = normalizeSettings(settings)
    mkdirSync(path.dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8")
    return normalized
  }
}
