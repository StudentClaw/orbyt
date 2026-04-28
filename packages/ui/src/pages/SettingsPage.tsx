import { useState } from "react"
import { SettingsSidebar, type SettingsSection } from "@/components/settings/SettingsSidebar"
import { GeneralSection } from "@/components/settings/GeneralSection"
import { NotificationsSection } from "@/components/settings/NotificationsSection"
import { StudyProfileSection } from "@/components/settings/StudyProfileSection"

type SettingsPageProps = {
  activeSection?: SettingsSection
  onSectionSelect?: (section: SettingsSection) => void
}

export function SettingsPage({
  activeSection: controlledSection,
  onSectionSelect,
}: SettingsPageProps = {}) {
  const [localSection, setLocalSection] = useState<SettingsSection>("general")
  const activeSection = controlledSection ?? localSection

  const handleSectionSelect = (section: SettingsSection) => {
    onSectionSelect?.(section)
    if (controlledSection === undefined) {
      setLocalSection(section)
    }
  }

  return (
    <div className="flex h-full" data-testid="settings-page">
      <SettingsSidebar active={activeSection} onSelect={handleSectionSelect} />
      <main className="flex-1 overflow-y-auto p-8">
        {activeSection === "general" && <GeneralSection />}
        {activeSection === "study-profile" && <StudyProfileSection />}
        {activeSection === "notifications" && <NotificationsSection />}
      </main>
    </div>
  )
}
