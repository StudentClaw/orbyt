import { type ActivityFeedEntryWithMeta, removeActivityEntry } from "@/rpc/activityState"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Archive } from "lucide-react"
import { getPrimaryWsRpcClient } from "@/rpc/appRuntime"
import { IpcChannel, type DailyInsightPayload } from "@orbyt/contracts"
import { MorningInsightCard } from "./MorningInsightCard"
import { EveningInsightCard } from "./EveningInsightCard"

interface ActivityFeedItemProps {
  readonly entry: ActivityFeedEntryWithMeta
  readonly index?: number
}

const THREE_HOURS_SEC = 3 * 60 * 60

// Defensive client-side fallback for legacy entries written before the server
// started normalizing course codes. New cron and reminder entries already
// arrive with simplified codes from packages/server/src/cron/course-code.ts.
const COURSE_CODE_TOKEN = /[A-Za-z0-9-]+_([A-Za-z0-9-]+)_[A-Za-z0-9_-]+/g

function simplifyCourseCodes(text: string): string {
  return text.replace(COURSE_CODE_TOKEN, (_match, kept: string) => kept)
}

function formatNotificationTime(iso: string | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  const then = date.getTime()
  if (Number.isNaN(then)) return null

  const now = new Date()
  const diffSec = Math.max(0, Math.floor((now.getTime() - then) / 1000))

  if (diffSec < 45) return "now"
  if (diffSec < 3600) return `${Math.max(1, Math.round(diffSec / 60))}m ago`
  if (diffSec < THREE_HOURS_SEC) return `${Math.round(diffSec / 3600)}h ago`

  const time = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (sameDay(date, now)) return time

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(date, yesterday)) return `Yesterday ${time}`

  const diffDays = Math.floor(diffSec / 86400)
  if (diffDays < 7) {
    const weekday = date.toLocaleDateString(undefined, { weekday: "short" })
    return `${weekday} ${time}`
  }

  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
  return `${day} ${time}`
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
    label: "Orby",
  },
  reminder: {
    container: "bg-pink-500/5 border-pink-500/20",
    iconBg: "bg-pink-500/15 text-pink-400",
    badge: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    label: "Reminder",
  },
}

const DEFAULT_STYLE: CategoryStyle = {
  container: "bg-white/5 border-white/10",
  iconBg: "bg-white/10 text-muted-foreground",
  badge: "bg-white/10 text-muted-foreground border-white/20",
  label: "Other",
}

function CategoryIcon({
  category,
  size = 18,
}: {
  readonly category: string
  readonly size?: number
}) {
  const stroke = 1.8
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }
  if (category === "canvas") {
    return (
      <svg {...common}>
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    )
  }
  if (category === "insight") {
    return (
      <svg {...common}>
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6M10 22h4" />
      </svg>
    )
  }
  if (category === "planner") {
    return (
      <svg {...common}>
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    )
  }
  if (category === "cron") {
    // Saturn — Orby's planetary mark.
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4.5" />
        <ellipse cx="12" cy="12" rx="10" ry="3.2" transform="rotate(-20 12 12)" />
      </svg>
    )
  }
  // workflow / default
  return (
    <svg {...common}>
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
  const [actedState] = useState<boolean | null>(entry.actedOn ?? null)
  const style = CATEGORY_STYLES[entry.category] ?? DEFAULT_STYLE
  const animationDelay = `${index * 40}ms`

  const handleClick = () => {
    const link = entry.deepLink
    if (!link) return

    if (/^https?:\/\//i.test(link)) {
      const opener = window.electronAPI?.invoke
      if (opener) {
        void opener(IpcChannel.SHELL_OPEN_EXTERNAL, { url: link })
        return
      }
      window.open(link, "_blank", "noopener,noreferrer")
      return
    }

    navigate({ to: link })
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

  const isInsight = entry.category === "insight"
  const structured: DailyInsightPayload | undefined = entry.structured
  const isClickable = Boolean(entry.deepLink) && !isInsight
  const shouldSimplifyCodes = entry.category === "insight" || entry.category === "cron"
  const displayTitle = shouldSimplifyCodes ? simplifyCourseCodes(entry.title) : entry.title
  const displayBody =
    entry.body && shouldSimplifyCodes ? simplifyCourseCodes(entry.body) : entry.body
  const timestampIso = entry.createdAt ?? entry.receivedAt
  const displayTime = formatNotificationTime(timestampIso)
  const absoluteTime = timestampIso
    ? new Date(timestampIso).toLocaleString()
    : undefined

  return (
    <div
      className={`
        group relative flex items-center gap-3 rounded-2xl
        backdrop-blur-md border shadow-sm
        transition-all duration-200
        animate-[slide-in-down_0.2s_ease-out]
        ${isInsight ? "px-5 py-4 border-2" : "px-4 py-3"}
        ${style.container}
        ${isClickable ? "cursor-pointer hover:bg-white/10 hover:border-white/20" : ""}
      `}
      style={{ animationDelay, animationFillMode: "both" }}
      onClick={isClickable ? handleClick : undefined}
      data-testid={`activity-item-${entry.id}`}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-2xl ${
          isInsight ? "h-11 w-11" : "h-10 w-10"
        } ${style.iconBg}`}
      >
        <CategoryIcon category={entry.category} size={isInsight ? 22 : 20} />
      </div>

      <div className="min-w-0 flex-1 pr-6">
        {displayTime && (
          <div className="mb-1 flex items-center">
            <time
              dateTime={timestampIso}
              title={absoluteTime}
              className="ml-auto pl-2 text-sm font-medium text-muted-foreground/80"
              data-testid={`activity-item-time-${entry.id}`}
            >
              {displayTime}
            </time>
          </div>
        )}
        <p
          className={`break-words font-semibold leading-snug ${
            isInsight ? "text-xl" : "text-lg"
          }`}
        >
          {displayTitle}
        </p>
        {isInsight && structured ? (
          structured.slot === "morning" ? (
            <MorningInsightCard payload={structured} entryId={entry.id} />
          ) : (
            <EveningInsightCard payload={structured} entryId={entry.id} />
          )
        ) : displayBody ? (
          <p
            className={`whitespace-pre-line break-words text-muted-foreground ${
              isInsight
                ? "mt-2 text-base leading-relaxed"
                : "mt-1.5 text-base leading-relaxed"
            }`}
            data-testid={`activity-item-body-${entry.id}`}
          >
            {displayBody}
          </p>
        ) : null}
        {actedState !== null && (
          <p
            className="mt-1.5 text-sm italic text-muted-foreground opacity-60"
            data-testid={`activity-item-acted-state-${entry.id}`}
          >
            {actedState ? "Marked acted" : "Dismissed"}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={dismissEntry}
        aria-label="Archive notification"
        title="Archive"
        className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/40 bg-background/40 text-muted-foreground opacity-0 transition-all duration-150 hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/35 group-hover:opacity-100 group-focus-within:opacity-100"
        data-testid={`activity-item-close-${entry.id}`}
      >
        <Archive className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
