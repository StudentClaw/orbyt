import { useState } from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { formatCountdown } from "./dashboard-model"
import {
  computePriorityDisplay,
  type PrioritizedItem,
} from "./priority-model"

interface PriorityCardProps {
  readonly item: PrioritizedItem
  readonly now: Date
  readonly rank?: number
}

const URGENCY_DOT: Record<string, string> = {
  overdue: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]",
  urgent: "bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.6)]",
  attention: "bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)]",
  calm: "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]",
}

const RANK_LABELS = ["①", "②", "③", "④", "⑤", "⑥", "⑦"]

type CheckinState = "idle" | "checkin" | "partial"

export function PriorityCard({ item, now, rank }: PriorityCardProps) {
  const [checkin, setCheckin] = useState<CheckinState>("idle")
  const [note, setNote] = useState("")

  const display = computePriorityDisplay(item, now)
  const countdown = formatCountdown(item.effectiveDueAt, now)
  const estimatedHours = (item.estimatedMinutes / 60).toFixed(1)
  const dotColor = URGENCY_DOT[display.zone] ?? "bg-gray-400"

  if (checkin === "partial") {
    return (
      <div
        className="flex flex-col gap-2 rounded-2xl backdrop-blur-xl bg-card/60 border border-white/10 px-4 py-3 animate-[flip-in_0.2s_ease-out]"
        data-testid={`priority-card-${item.id}`}
      >
        <p className="text-xs text-muted-foreground">
          What happened with{" "}
          <span className="font-medium text-foreground">{item.title}</span>?
        </p>
        <Textarea
          placeholder="Optional note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-16 resize-none text-xs"
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl bg-primary/15 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
            onClick={() => {
              setCheckin("idle")
              setNote("")
            }}
          >
            Submit
          </button>
          <button
            type="button"
            className="rounded-xl px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/5"
            onClick={() => {
              setCheckin("idle")
              setNote("")
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (checkin === "checkin") {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl backdrop-blur-xl bg-card/60 border border-white/10 px-4 py-3 animate-[flip-in_0.2s_ease-out]"
        data-testid={`priority-card-${item.id}`}
      >
        <p className="min-w-0 flex-1 truncate text-sm">
          Done with <span className="font-medium">{item.title}</span>?
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-green-500 transition-colors hover:bg-green-500/10"
            onClick={() => setCheckin("idle")}
          >
            Yes
          </button>
          <button
            type="button"
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
            onClick={() => setCheckin("idle")}
          >
            No
          </button>
          <button
            type="button"
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-yellow-500 transition-colors hover:bg-yellow-500/10"
            onClick={() => setCheckin("partial")}
          >
            Yes, but…
          </button>
        </div>
      </div>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl backdrop-blur-xl bg-card/60 border border-white/10 px-4 py-3 text-left transition-colors hover:bg-white/5"
          data-testid={`priority-card-${item.id}`}
        >
          {rank !== undefined && (
            <span className="w-5 shrink-0 text-center text-xs text-muted-foreground/60">
              {RANK_LABELS[rank] ?? `${rank + 1}`}
            </span>
          )}
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`}
            aria-hidden
            data-testid={`urgency-badge-${item.id}`}
          />
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-medium"
              data-testid={`priority-title-${item.id}`}
            >
              {item.title}
            </p>
            <p className="text-xs text-muted-foreground">{item.courseCode}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <span
              className="font-medium text-foreground/70"
              data-testid={`countdown-${item.id}`}
            >
              {countdown}
            </span>
            <span className="text-muted-foreground" data-testid={`effort-${item.id}`}>
              {estimatedHours}h
            </span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 rounded-2xl backdrop-blur-xl bg-card/80 border border-white/10 p-4 shadow-xl"
        side="right"
        sideOffset={8}
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.courseCode}</p>
          </div>
          {item.effectiveDueAt && (
            <p className="text-xs text-muted-foreground">
              Due{" "}
              {new Date(item.effectiveDueAt).toLocaleDateString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Est. {estimatedHours}h of work</p>
          <button
            type="button"
            className="w-full rounded-xl bg-primary/10 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            onClick={() => setCheckin("checkin")}
          >
            Mark complete
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
