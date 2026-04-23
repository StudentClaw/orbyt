import type {
  ExtensionRegistryEntry,
  GatewayToolInventoryEntry,
  GatewayToolInventorySnapshot,
} from "@orbyt/contracts"

const ELIGIBLE_RUNNING_STATUSES = new Set<ExtensionRegistryEntry["status"]>(["ready", "active"])

export function formatGatewayNamespace(pluginId: string): string {
  const withoutSuffix = pluginId.replace(/-mcp$/, "")
  return withoutSuffix.replace(/-/g, "_")
}

export function formatGatewayToolName(pluginId: string, rawToolName: string): string {
  return `${formatGatewayNamespace(pluginId)}.${rawToolName}`
}

export function mapGatewayInventory(entries: ReadonlyArray<ExtensionRegistryEntry>): GatewayToolInventoryEntry[] {
  return entries.flatMap((entry) => {
    if (
      entry.kind !== "available"
      || !ELIGIBLE_RUNNING_STATUSES.has(entry.status)
      || !entry.enabled
    ) {
      return []
    }

    return entry.manifest.tools.map((tool) => ({
      exposedToolName: formatGatewayToolName(entry.manifest.id, tool.name),
      description: tool.description,
      pluginId: entry.manifest.id,
      rawToolName: tool.name,
    }))
  })
}

export function createGatewayInventorySnapshot(
  entries: ReadonlyArray<ExtensionRegistryEntry>,
  revision: number,
  observedAt: string,
): GatewayToolInventorySnapshot {
  return {
    revision,
    observedAt,
    tools: mapGatewayInventory(entries),
  }
}
