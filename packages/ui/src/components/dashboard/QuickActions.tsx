import { Button } from "@/components/ui/button"

interface QuickActionsProps {
  readonly connected?: boolean
  readonly onAction?: (action: string) => void
}

const ACTIONS = [
  { id: "plan-week", label: "Plan my week" },
  { id: "help-with", label: "Help with..." },
  { id: "whats-important", label: "What's most important?" },
] as const

export function QuickActions({ connected = true, onAction }: QuickActionsProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Quick Actions</h2>
      <div className="flex flex-wrap gap-2" data-testid="quick-actions">
        {ACTIONS.map((action) => (
          <Button
            key={action.id}
            variant="outline"
            size="sm"
            disabled={!connected}
            data-testid={`action-${action.id}`}
            onClick={() => onAction?.(action.id)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
