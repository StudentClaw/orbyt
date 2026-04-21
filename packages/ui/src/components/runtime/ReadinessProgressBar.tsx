import { cn } from "@/lib/utils"

const READINESS_STAGE_LABELS = [
  "Connecting to Student Claw",
  "Loading chat state",
  "Preparing Codex",
] as const

interface ReadinessProgressBarProps {
  readonly activeStage: 0 | 1 | 2
  readonly className?: string
  readonly testId?: string
}

export function ReadinessProgressBar({
  activeStage,
  className,
  testId,
}: ReadinessProgressBarProps) {
  return (
    <div
      aria-label="Runtime readiness progress"
      aria-valuetext={READINESS_STAGE_LABELS[activeStage]}
      className={cn("w-full space-y-3", className)}
      data-testid={testId}
      role="progressbar"
    >
      <div className="grid grid-cols-3 gap-2">
        {READINESS_STAGE_LABELS.map((label, index) => {
          const isComplete = index < activeStage
          const isActive = index === activeStage

          return (
            <div
              key={label}
              className={cn(
                "h-2 rounded-full transition-colors",
                isComplete ? "bg-primary" : "bg-muted",
                isActive ? "bg-primary/80 animate-pulse" : undefined,
              )}
            />
          )
        })}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
        {READINESS_STAGE_LABELS.map((label, index) => (
          <span
            key={label}
            className={cn(
              "truncate",
              index === activeStage ? "font-medium text-foreground" : undefined,
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
