import { type ActivityFeedEntryWithMeta, removeActivityEntry } from "@/rpc/activityState"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { getPrimaryWsRpcClient } from "@/rpc/appRuntime"

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
  cron: {
    container: "bg-cyan-500/5 border-cyan-500/20",
    iconBg: "bg-cyan-500/15 text-cyan-400",
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    label: "Proactive",
  },
  reminder: {
    container: "bg-pink-500/5 border-pink-500/20",
    iconBg: "bg-pink-500/15 text-pink-400",
    badge: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    label: "Reminder",
  },
}

const ACTABLE_CATEGORIES = new Set(["insight", "cron"])

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
  const [actedState, setActedState] = useState<boolean | null>(
    entry.actedOn ?? null,
  )
  const style = CATEGORY_STYLES[entry.category] ?? DEFAULT_STYLE
  const animationDelay = `${index * 40}ms`
  const showActions =
    ACTABLE_CATEGORIES.has(entry.category) && actedState === null

  const handleClick = () => {
    if (entry.deepLink) {
      navigate({ to: entry.deepLink })
    }
  }

  const setActed = (acted: boolean) => async (
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation()
    setActedState(acted)
    try {
      const client = getPrimaryWsRpcClient()
      await client.activity.setActed({ id: entry.id, acted })
    } catch {
      setActedState(null)
    }
  }

  const dismissEntry = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    // Optimistically remove from UI; reinstate on failure.
    const previousEntry = entry
    removeActivityEntry(entry.id)
    try {
      const client = getPrimaryWsRpcClient()
      await client.activity.setActed({ id: previousEntry.id, acted: false })
    } catch {
      // Best-effort: if the persistence call fails, the next refresh from the
      // server will re-hydrate the entry since acted_on stayed NULL.
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
        {showActions && (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={setActed(true)}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-muted-foreground hover:bg-white/10"
              data-testid={`activity-item-acted-${entry.id}`}
            >
              Mark acted
            </button>
            <button
              type="button"
              onClick={setActed(false)}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-muted-foreground hover:bg-white/10"
              data-testid={`activity-item-dismiss-${entry.id}`}
            >
              Dismiss
            </button>
          </div>
        )}
        {actedState !== null && (
          <p
            className="mt-1.5 text-xs italic text-muted-foreground opacity-60"
            data-testid={`activity-item-acted-state-${entry.id}`}
          >
            {actedState ? "Marked acted" : "Dismissed"}
          </p>
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

      <button
        type="button"
        onClick={dismissEntry}
        aria-label="Dismiss notification"
        title="Dismiss"
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all duration-150 hover:bg-white/10 hover:text-foreground group-hover:opacity-70"
        data-testid={`activity-item-close-${entry.id}`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
