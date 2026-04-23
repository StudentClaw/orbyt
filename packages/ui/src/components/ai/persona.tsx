import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export type PersonaState = "idle" | "listening" | "thinking" | "speaking" | "asleep"

const PERSONA_VARIANTS = {
  obsidian: {
    initials: "SC",
    avatarClassName: "bg-primary/10 text-primary",
  },
  mana: {
    initials: "SC",
    avatarClassName: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  opal: {
    initials: "SC",
    avatarClassName: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  },
  halo: {
    initials: "SC",
    avatarClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  glint: {
    initials: "SC",
    avatarClassName: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  },
  command: {
    initials: "SC",
    avatarClassName: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
} as const

const PERSONA_COPY: Record<PersonaState, { title: string; detail: string; badgeClassName: string }> = {
  idle: {
    title: "Standing by",
    detail: "Ready when you want to ask something.",
    badgeClassName: "bg-emerald-500",
  },
  listening: {
    title: "Listening",
    detail: "Taking in your context before responding.",
    badgeClassName: "bg-sky-500",
  },
  thinking: {
    title: "Thinking",
    detail: "Working through the next response.",
    badgeClassName: "bg-amber-500",
  },
  speaking: {
    title: "Responding",
    detail: "Streaming the current answer.",
    badgeClassName: "bg-primary",
  },
  asleep: {
    title: "Offline",
    detail: "The provider is unavailable right now.",
    badgeClassName: "bg-muted-foreground",
  },
}

interface PersonaProps {
  readonly state: PersonaState
  readonly className?: string
  readonly variant?: keyof typeof PERSONA_VARIANTS
}

export function Persona({
  state,
  className,
  variant = "obsidian",
}: PersonaProps) {
  const appearance = PERSONA_VARIANTS[variant] ?? PERSONA_VARIANTS.obsidian
  const copy = PERSONA_COPY[state]

  return (
    <div
      data-testid="chat-persona"
      aria-label={`Orbyt is ${copy.title.toLowerCase()}`}
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-muted/30 px-3 py-2",
        className,
      )}
    >
      <Avatar size="sm">
        <AvatarFallback className={appearance.avatarClassName}>
          {appearance.initials}
        </AvatarFallback>
        <AvatarBadge className={copy.badgeClassName} />
      </Avatar>
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{copy.title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{copy.detail}</p>
      </div>
    </div>
  )
}
