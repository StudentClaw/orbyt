import { useState } from "react"
import { SettingsSidebar, type SettingsSection } from "@/components/settings/SettingsSidebar"
import { GeneralSection } from "@/components/settings/GeneralSection"
import { SchedulePreferencesSection } from "@/components/settings/SchedulePreferencesSection"
import { ConnectionsSection } from "@/components/settings/ConnectionsSection"
import { NotificationsSection } from "@/components/settings/NotificationsSection"

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general")

  return (
    <div className="flex h-full" data-testid="settings-page">
      <SettingsSidebar active={activeSection} onSelect={setActiveSection} />
      <main className="flex-1 overflow-y-auto p-8">
        {activeSection === "general" && <GeneralSection />}
        {activeSection === "schedule" && <SchedulePreferencesSection />}
        {activeSection === "connections" && <ConnectionsSection />}
        {activeSection === "notifications" && <NotificationsSection />}
      </main>
    </div>
  )
}
