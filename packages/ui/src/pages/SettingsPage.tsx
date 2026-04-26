import { useState } from "react"
import { SettingsSidebar, type SettingsSection } from "@/components/settings/SettingsSidebar"
import { GeneralSection } from "@/components/settings/GeneralSection"
import { ConnectionsSection } from "@/components/settings/ConnectionsSection"
import { NotificationsSection } from "@/components/settings/NotificationsSection"
import { StudyProfileSection } from "@/components/settings/StudyProfileSection"

type SettingsPageProps = {
  activeSection?: SettingsSection
  onSectionSelect?: (section: SettingsSection) => void
  selectedPluginId?: string | null
  onPluginSelect?: (pluginId: string) => void
  onPluginBack?: () => void
}

export function SettingsPage({
  activeSection: controlledSection,
  onSectionSelect,
  selectedPluginId,
  onPluginSelect,
  onPluginBack,
}: SettingsPageProps = {}) {
  const [localSection, setLocalSection] = useState<SettingsSection>("general")
  const [localPluginId, setLocalPluginId] = useState<string | null>(null)
  const activeSection = controlledSection ?? localSection
  const effectivePluginId = selectedPluginId ?? localPluginId

  const handleSectionSelect = (section: SettingsSection) => {
    onSectionSelect?.(section)
    if (controlledSection === undefined) {
      setLocalSection(section)
    }

    if (section !== "connections" && selectedPluginId === undefined) {
      setLocalPluginId(null)
    }
  }

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
    <div className="flex h-full" data-testid="settings-page">
      <SettingsSidebar active={activeSection} onSelect={handleSectionSelect} />
      <main className="flex-1 overflow-y-auto p-8">
        {activeSection === "general" && <GeneralSection />}
        {activeSection === "study-profile" && <StudyProfileSection />}
        {activeSection === "connections" && (
          <ConnectionsSection
            selectedPluginId={effectivePluginId}
            onSelectPlugin={handlePluginSelect}
            onBackToRegistry={handlePluginBack}
          />
        )}
        {activeSection === "notifications" && <NotificationsSection />}
      </main>
    </div>
  )
}
