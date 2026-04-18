import type { ChatStatus } from "@/hooks/chat-model"
import { getChatStatusPresentation } from "@/hooks/chat-model"
import { cn } from "@/lib/utils"

interface ChatStatusBadgeProps {
  readonly status: ChatStatus
  readonly className?: string
}

const FALLBACK_PRESENTATION = {
  label: "Unknown",
  dotClassName: "bg-muted-foreground/60",
  pulse: false,
} as const

export function ChatStatusBadge({ status, className }: ChatStatusBadgeProps) {
  const presentation = getChatStatusPresentation(status) ?? FALLBACK_PRESENTATION

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground",
        className,
      )}
      data-testid="chat-status-badge"
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 rounded-full",
          presentation.dotClassName,
          presentation.pulse ? "animate-pulse" : undefined,
        )}
      />
      <span>{presentation.label}</span>
    </div>
  )
}
