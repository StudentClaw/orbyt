export type SettingsSection = "general" | "schedule" | "connections" | "notifications"

const NAV_ITEMS: Array<{ id: SettingsSection; label: string }> = [
  { id: "general", label: "General" },
  { id: "schedule", label: "Schedule & Preferences" },
  { id: "connections", label: "Connections" },
  { id: "notifications", label: "Notifications" },
]

interface SettingsSidebarProps {
  active: SettingsSection
  onSelect: (section: SettingsSection) => void
}

export function SettingsSidebar({ active, onSelect }: SettingsSidebarProps) {
  return (
    <nav
      className="w-52 shrink-0 border-r border-border bg-background/50 px-3 py-6"
      data-testid="settings-sidebar"
    >
      <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Settings
      </p>
      <ul className="space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              data-testid={`settings-nav-${item.id}`}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                active === item.id
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              }`}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
