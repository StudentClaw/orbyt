import { useEffect, useState } from "react"
import {
  IpcChannel,
  type ExtensionRegistryEntry,
} from "@orbyt/contracts"
import { formatPluginLabel } from "@/lib/rootNavbar"

function getPluginNameById(entries: readonly ExtensionRegistryEntry[], pluginId: string): string | null {
  const match = entries.find((entry) => {
    if (entry.kind === "available") {
      return entry.manifest.id === pluginId
    }

    return entry.pluginId === pluginId
  })

  if (!match) {
    return null
  }

  return match.kind === "available" ? match.manifest.name : match.displayName
}

export function usePluginDisplayName(pluginId: string | null, enabled = true): string | null {
  const [pluginName, setPluginName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!enabled || !pluginId) {
      setPluginName(null)
      return () => {
        cancelled = true
      }
    }

    const fallbackName = formatPluginLabel(pluginId)
    setPluginName(fallbackName)

    if (!window.electronAPI?.invoke) {
      return () => {
        cancelled = true
      }
    }

    window.electronAPI.invoke(IpcChannel.PLUGIN_LIST)
      .then((entries: ExtensionRegistryEntry[]) => {
        if (cancelled) {
          return
        }

        setPluginName(getPluginNameById(entries, pluginId) ?? fallbackName)
      })
      .catch(() => {
        if (!cancelled) {
          setPluginName(fallbackName)
        }
      })

    return () => {
      cancelled = true
    }
  }, [enabled, pluginId])

  return pluginName
}
