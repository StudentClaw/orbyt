import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

const CATEGORIES = [
  { id: "canvas", label: "Canvas" },
  { id: "planner", label: "Planner" },
  { id: "workflow", label: "Agent" },
  { id: "insight", label: "Insights" },
] as const

export function NotificationSettings() {
  const [masterEnabled, setMasterEnabled] = useState(true)
  const [categoryToggles, setCategoryToggles] = useState<Record<string, boolean>>({
    canvas: true,
    planner: true,
    workflow: true,
    insight: true,
  })
  const [quietStart, setQuietStart] = useState("22:00")
  const [quietEnd, setQuietEnd] = useState("08:00")

  const toggleCategory = (id: string) => {
    setCategoryToggles((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  return (
    <div className="space-y-6 p-4" data-testid="notification-settings">
      <div>
        <h3 className="text-lg font-semibold">Notification Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure which notifications you receive.
        </p>
      </div>

      <div className="flex items-center gap-3" data-testid="notif-master-toggle">
        <Switch
          checked={masterEnabled}
          onCheckedChange={setMasterEnabled}
        />
        <Label>Enable notifications</Label>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-sm font-medium">Categories</Label>
        {CATEGORIES.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center gap-3"
            data-testid={`notif-toggle-${cat.id}`}
          >
            <Switch
              checked={masterEnabled && categoryToggles[cat.id]}
              onCheckedChange={() => toggleCategory(cat.id)}
              disabled={!masterEnabled}
            />
            <Label>{cat.label}</Label>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-sm font-medium">Quiet Hours</Label>
        <div className="flex items-center gap-3">
          <Input
            type="time"
            value={quietStart}
            onChange={(e) => setQuietStart(e.target.value)}
            className="w-28"
            data-testid="notif-quiet-start"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="time"
            value={quietEnd}
            onChange={(e) => setQuietEnd(e.target.value)}
            className="w-28"
            data-testid="notif-quiet-end"
          />
        </div>
      </div>
    </div>
  )
}
