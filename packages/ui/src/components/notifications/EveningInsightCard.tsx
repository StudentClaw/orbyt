import type { EveningInsightPayload, EveningRecapItem } from "@orbyt/contracts"

interface EveningInsightCardProps {
  readonly payload: EveningInsightPayload
  readonly entryId: string
}

const COURSE_CODE_TOKEN = /[A-Za-z0-9-]+_([A-Za-z0-9-]+)_[A-Za-z0-9_-]+/g

function simplify(text: string): string {
  return text.replace(COURSE_CODE_TOKEN, (_match, kept: string) => kept)
}

function chipPalette(kind: EveningRecapItem["kind"]): {
  readonly border: string
  readonly bg: string
  readonly fg: string
} {
  if (kind === "session") {
    return {
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/10",
      fg: "text-emerald-200",
    }
  }
  if (kind === "submission") {
    return {
      border: "border-sky-500/30",
      bg: "bg-sky-500/10",
      fg: "text-sky-200",
    }
  }
  return {
    border: "border-white/15",
    bg: "bg-white/5",
    fg: "text-muted-foreground",
  }
}

/**
 * Structured renderer for evening daily-insight cards.
 *   briefing: recap summary + chip row, throughline as the emphasized callout,
 *             tomorrow as muted footer, optional wind-down italicized last line.
 *   quiet:    centered throughline (still the week-pattern observation) plus
 *             optional reflection prompt.
 */
export function EveningInsightCard({ payload, entryId }: EveningInsightCardProps) {
  if (payload.mode === "quiet") {
    return (
      <div
        className="mt-2 flex flex-col gap-2"
        data-testid={`evening-insight-quiet-${entryId}`}
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          {simplify(payload.throughline)}
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
      data-testid={`evening-insight-briefing-${entryId}`}
    >
      <p
        className="text-sm leading-relaxed text-foreground/90"
        data-testid={`evening-insight-recap-summary-${entryId}`}
      >
        {simplify(payload.recap.summary)}
      </p>

      {payload.recap.items.length > 0 ? (
        <ul
          className="flex flex-wrap gap-1.5"
          data-testid={`evening-insight-recap-items-${entryId}`}
        >
          {payload.recap.items.map((item, idx) => {
            const palette = chipPalette(item.kind)
            return (
              <li
                key={`${item.kind}-${item.label}-${idx}`}
                className={`flex items-baseline gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${palette.border} ${palette.bg} ${palette.fg}`}
                data-testid={`evening-insight-recap-item-${idx}`}
              >
                {item.course ? (
                  <span className="font-medium">
                    {simplify(item.course)}
                  </span>
                ) : null}
                <span className="text-muted-foreground">
                  {simplify(item.label)}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}

      <div
        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5"
        data-testid={`evening-insight-throughline-${entryId}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
          Pattern of the week
        </p>
        <p className="mt-1 text-sm leading-relaxed text-amber-50">
          {simplify(payload.throughline)}
        </p>
      </div>

      <p
        className="text-xs leading-relaxed text-muted-foreground/80"
        data-testid={`evening-insight-tomorrow-${entryId}`}
      >
        {simplify(payload.tomorrow)}
      </p>

      {payload.windDown ? (
        <p
          className="text-xs italic leading-relaxed text-muted-foreground/60"
          data-testid={`evening-insight-winddown-${entryId}`}
        >
          {simplify(payload.windDown)}
        </p>
      ) : null}
    </div>
  )
}
