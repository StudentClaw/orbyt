import { useState } from "react"
import { ConnectionsSection } from "@/components/settings/ConnectionsSection"

type PluginsPageProps = {
  selectedPluginId?: string | null
  onPluginSelect?: (pluginId: string) => void
  onPluginBack?: () => void
}

export function PluginsPage({
  selectedPluginId,
  onPluginSelect,
  onPluginBack,
}: PluginsPageProps = {}) {
  const [localPluginId, setLocalPluginId] = useState<string | null>(null)
  const effectivePluginId = selectedPluginId ?? localPluginId

  const handlePluginSelect = (pluginId: string) => {
    onPluginSelect?.(pluginId)
    if (selectedPluginId === undefined) {
      setLocalPluginId(pluginId)
    }
  }

  const handlePluginBack = () => {
    onPluginBack?.()
    if (selectedPluginId === undefined) {
      setLocalPluginId(null)
    }
  }

  return (
    <main className="h-full overflow-y-auto px-5 py-8 sm:px-8" data-testid="plugins-page">
      <div className="mx-auto w-full max-w-6xl">
        <ConnectionsSection
          selectedPluginId={effectivePluginId}
          onSelectPlugin={handlePluginSelect}
          onBackToRegistry={handlePluginBack}
        />
      </div>
    </main>
  )
}
