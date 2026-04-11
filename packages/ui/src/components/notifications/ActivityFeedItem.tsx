import type { ActivityFeedEntryWithMeta } from "@/rpc/activityState"
import { useNavigate } from "@tanstack/react-router"

interface ActivityFeedItemProps {
  readonly entry: ActivityFeedEntryWithMeta
  readonly index?: number
}

interface CategoryStyle {
  readonly container: string
  readonly iconBg: string
  readonly badge: string
  readonly label: string
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  canvas: {
    container: "bg-blue-500/5 border-blue-500/20",
    iconBg: "bg-blue-500/15 text-blue-400",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    label: "Canvas",
  },
  planner: {
    container: "bg-green-500/5 border-green-500/20",
    iconBg: "bg-green-500/15 text-green-400",
    badge: "bg-green-500/10 text-green-400 border-green-500/20",
    label: "Planner",
  },
  workflow: {
    container: "bg-purple-500/5 border-purple-500/20",
    iconBg: "bg-purple-500/15 text-purple-400",
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    label: "Agent",
  },
  insight: {
    container: "bg-amber-500/5 border-amber-500/20",
    iconBg: "bg-amber-500/15 text-amber-400",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    label: "Insight",
  },
}

const DEFAULT_STYLE: CategoryStyle = {
  container: "bg-white/5 border-white/10",
  iconBg: "bg-white/10 text-muted-foreground",
  badge: "bg-white/10 text-muted-foreground border-white/20",
  label: "Other",
}

function CategoryIcon({ category }: { readonly category: string }) {
  if (category === "canvas") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    )
  }
  if (category === "insight") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6M10 22h4" />
      </svg>
    )
  }
  if (category === "planner") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    )
  }
  // workflow / default
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="10" x="3" y="11" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" x2="8" y1="16" y2="16" />
      <line x1="16" x2="16" y1="16" y2="16" />
    </svg>
  )
}

export function ActivityFeedItem({ entry, index = 0 }: ActivityFeedItemProps) {
  const navigate = useNavigate()
  const style = CATEGORY_STYLES[entry.category] ?? DEFAULT_STYLE
  const animationDelay = `${index * 40}ms`

  const handleClick = () => {
    if (entry.deepLink) {
      navigate({ to: entry.deepLink })
    }
  }

  return (
    <div
      className={`
        group relative flex items-start gap-3 rounded-2xl
        backdrop-blur-md border px-4 py-3 shadow-sm
        transition-all duration-200
        animate-[slide-in-down_0.2s_ease-out]
        ${style.container}
        ${entry.deepLink ? "cursor-pointer hover:bg-white/10 hover:border-white/20" : ""}
      `}
      style={{ animationDelay, animationFillMode: "both" }}
      onClick={entry.deepLink ? handleClick : undefined}
      data-testid={`activity-item-${entry.id}`}
    >
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}>
        <CategoryIcon category={entry.category} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${style.badge}`}
          >
            {style.label}
          </span>
        </div>
        <p className="text-sm font-medium leading-snug">{entry.title}</p>
        {entry.body && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{entry.body}</p>
        )}
      </div>

      {entry.deepLink && (
        <span
          className="mt-1 shrink-0 text-muted-foreground opacity-40 transition-opacity duration-150 group-hover:opacity-70"
          data-testid={`activity-item-link-${entry.id}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
      )}
    </div>
  )
}
