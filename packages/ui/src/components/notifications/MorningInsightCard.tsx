import { IpcChannel, type MorningInsightPayload } from "@orbyt/contracts"

interface MorningInsightCardProps {
  readonly payload: MorningInsightPayload
  readonly entryId: string
}

const COURSE_CODE_TOKEN = /[A-Za-z0-9-]+_([A-Za-z0-9-]+)_[A-Za-z0-9_-]+/g

function simplify(text: string): string {
  return text.replace(COURSE_CODE_TOKEN, (_match, kept: string) => kept)
}

function formatDueTime(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  const today = new Date()
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
  return sameDay ? `by ${time}` : `by ${d.toLocaleDateString(undefined, { weekday: "short" })} ${time}`
}

function openDeepLink(link: string): void {
  if (/^https?:\/\//i.test(link)) {
    const opener = window.electronAPI?.invoke
    if (opener) {
      void opener(IpcChannel.SHELL_OPEN_EXTERNAL, { url: link })
      return
    }
    window.open(link, "_blank", "noopener,noreferrer")
  }
}

/**
 * Structured renderer for morning daily-insight cards. Two layouts:
 *   - briefing: anchor caption, must-do clickable list, lever callout, horizon footer
 *   - quiet:    centered headline + lever (+ optional reflection prompt)
 *
 * Plain title/body fallback lives in ActivityFeedItem; this component only
 * runs when a structured payload is present.
 */
export function MorningInsightCard({ payload, entryId }: MorningInsightCardProps) {
  if (payload.mode === "quiet") {
    return (
      <div
        className="mt-2 flex flex-col gap-2"
        data-testid={`morning-insight-quiet-${entryId}`}
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          {simplify(payload.lever)}
        </p>
        {payload.reflection ? (
          <p className="text-sm italic leading-relaxed text-amber-300/80">
            {simplify(payload.reflection)}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="mt-2 flex flex-col gap-3"
      data-testid={`morning-insight-briefing-${entryId}`}
    >
      <p
        className="text-xs uppercase tracking-wide text-muted-foreground/80"
        data-testid={`morning-insight-anchor-${entryId}`}
      >
        {simplify(payload.anchor)}
      </p>

      {payload.mustDo.length > 0 ? (
        <ul
          className="flex flex-col gap-1.5"
          data-testid={`morning-insight-mustdo-${entryId}`}
        >
          {payload.mustDo.map((item, idx) => {
            const due = formatDueTime(item.dueTime)
            const clickable = Boolean(item.deepLink)
            const handleClick = (e: React.MouseEvent) => {
              if (!item.deepLink) return
              e.stopPropagation()
              openDeepLink(item.deepLink)
            }
            return (
              <li
                key={`${item.course}-${item.title}-${idx}`}
                className={`flex items-baseline justify-between gap-3 rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-sm ${
                  clickable
                    ? "cursor-pointer transition-colors hover:border-amber-500/30 hover:bg-amber-500/10"
                    : ""
                }`}
                onClick={clickable ? handleClick : undefined}
                data-testid={`morning-insight-mustdo-item-${idx}`}
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-amber-200">
                    {simplify(item.course)}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {simplify(item.title)}
                  </span>
                </span>
                {due ? (
                  <span className="shrink-0 text-xs text-muted-foreground/80">
                    {due}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      <div
        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5"
        data-testid={`morning-insight-lever-${entryId}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
          Best move today
        </p>
        <p className="mt-1 text-sm leading-relaxed text-amber-50">
          {simplify(payload.lever)}
        </p>
      </div>

      {payload.horizon ? (
        <p
          className="text-xs leading-relaxed text-muted-foreground/70"
          data-testid={`morning-insight-horizon-${entryId}`}
        >
          {simplify(payload.horizon)}
        </p>
      ) : null}
    </div>
  )
}
