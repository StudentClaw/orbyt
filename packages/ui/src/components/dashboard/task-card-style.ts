import { computePriorityDisplay, type PrioritizedItem } from "./priority-model"

export function resolvedBorderColor(item: PrioritizedItem, now: Date, accentColor?: string): string {
  if (accentColor) return accentColor
  if (item.courseColor) return item.courseColor
  const { zone } = computePriorityDisplay(item, now)
  switch (zone) {
    case "overdue":
      return "var(--destructive)"
    case "urgent":
      return "var(--warning)"
    case "attention":
      return "oklch(0.79 0.14 78)"
    case "calm":
    default:
      return "color-mix(in oklab, var(--muted-foreground) 65%, transparent)"
  }
}
