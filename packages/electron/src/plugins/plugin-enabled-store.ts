import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

type EnabledMap = Record<string, boolean>

function readEnabledMap(filePath: string): EnabledMap {
  if (!existsSync(filePath)) {
    return {}
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as EnabledMap
    }
  } catch {
    // Corrupted file — start fresh
  }

  return {}
}

export class PluginEnabledStore {
  private readonly filePath: string
  private map: EnabledMap

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "plugin-prefs.json")
    this.map = readEnabledMap(this.filePath)
  }

  isEnabled(pluginId: string): boolean {
    // Default to true if never explicitly set
    return this.map[pluginId] ?? true
  }

  setEnabled(pluginId: string, enabled: boolean): void {
    this.map = { ...this.map, [pluginId]: enabled }
    writeFileSync(this.filePath, JSON.stringify(this.map, null, 2), "utf8")
  }
}
