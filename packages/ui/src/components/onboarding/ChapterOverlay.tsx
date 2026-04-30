import { OrbytMark } from "../runtime/OrbytMark"

export interface ChapterAction {
  readonly label: string
  readonly variant: "primary" | "secondary"
  readonly onClick: () => void
  readonly testId?: string
}

interface ChapterOverlayProps {
  readonly title: string
  readonly subtitle: string
  readonly stepLabel: string
  readonly actions: ReadonlyArray<ChapterAction>
}

const PRIMARY_BTN_STYLE = {
  background: "rgb(59,130,246)",
  boxShadow: "0 4px 18px rgba(59,130,246,0.45)",
} as const

export function ChapterOverlay({
  title,
  subtitle,
  stepLabel,
  actions,
}: ChapterOverlayProps) {
  return (
    <div
      data-testid="walkthrough-chapter"
      className="fixed inset-0 z-[110] flex items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(15,23,52,0.85) 0%, rgba(7,9,15,0.97) 70%)",
        backdropFilter: "blur(8px)",
        animation: "tour-chapter-in 0.6s ease",
      }}
    >
      <div className="flex max-w-[640px] flex-col items-center px-6 text-center">
        <div className="mb-8 grid place-items-center">
          <OrbytMark size={180} />
        </div>
        <div
          className="mb-2 text-[11px] uppercase tracking-[0.18em]"
          style={{ color: "rgba(255,255,255,0.45)", fontWeight: 600 }}
          data-testid="walkthrough-chapter-step-label"
        >
          {stepLabel}
        </div>
        <h2
          className="mb-3 text-white"
          style={{
            fontFamily: "var(--font-brand, 'Instrument Serif'), Georgia, serif",
            fontSize: 56,
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
          }}
        >
          {title}
        </h2>
        <p
          className="mb-9 text-lg italic"
          style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}
        >
          {subtitle}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {actions.map((action) => {
            const isPrimary = action.variant === "primary"
            return (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                data-testid={action.testId}
                className={
                  isPrimary
                    ? "rounded-full px-10 py-3.5 text-base font-semibold text-white transition"
                    : "rounded-full border border-white/10 bg-white/5 px-8 py-3.5 text-base font-medium text-white/75 transition hover:bg-white/10"
                }
                style={isPrimary ? PRIMARY_BTN_STYLE : undefined}
              >
                {action.label}
              </button>
            )
          })}
        </div>
      </div>
      <style>{`
        @keyframes tour-chapter-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
