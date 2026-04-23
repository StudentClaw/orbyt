import type { PluginRuntimeLogEntry } from "@orbyt/contracts"

export type PluginRuntimeLogQuery = {
  pluginId?: string
  limit?: number
}

export class PluginRuntimeLogBuffer {
  private readonly entries: PluginRuntimeLogEntry[] = []

  constructor(private readonly maxEntries = 200) {}

  addEntry(entry: PluginRuntimeLogEntry): void {
    this.entries.push(entry)
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries)
    }
  }

  getEntries(query: PluginRuntimeLogQuery = {}): PluginRuntimeLogEntry[] {
    const filtered = query.pluginId
      ? this.entries.filter((entry) => entry.pluginId === query.pluginId)
      : [...this.entries]

    if (query.limit === undefined || query.limit >= filtered.length) {
      return filtered
    }

    return filtered.slice(Math.max(0, filtered.length - query.limit))
  }
}
