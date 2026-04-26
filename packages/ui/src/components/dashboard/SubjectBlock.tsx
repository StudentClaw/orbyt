import type { Course } from "@orbyt/contracts"
import type { PrioritizedItem } from "./priority-model"
import { TaskCard } from "./TaskCard"
import { courseAccentColor } from "./course-accent"

interface SubjectBlockProps {
  readonly course: Course
  readonly items: ReadonlyArray<PrioritizedItem>
  readonly now: Date
  readonly onAssignmentSelect?: (item: PrioritizedItem) => void
  readonly onAssignmentArchive?: (item: PrioritizedItem) => void
}

export function SubjectBlock({ course, items, now, onAssignmentSelect, onAssignmentArchive }: SubjectBlockProps) {
  const accent = courseAccentColor(course.id, course.color)
  return (
    <section
      className="dashboard-reveal-section border-t border-border/50 py-7 first:border-t-0 first:pt-0 last:pb-0"
      data-testid={`subject-block-${course.id}`}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span
            aria-hidden
            className="h-4 w-1 self-center rounded-sm"
            style={{ backgroundColor: accent }}
          />
          <h2
            className="text-lg font-semibold tracking-tight"
            style={{ color: accent }}
          >
            {course.name}
          </h2>
          <span className="truncate text-sm text-muted-foreground">{course.code}</span>
        </div>
        <span
          className="rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums"
          style={{
            color: accent,
            borderColor: `color-mix(in oklab, ${accent} 32%, var(--border))`,
            backgroundColor: `color-mix(in oklab, ${accent} 10%, transparent)`,
          }}
        >
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {items.map((item, index) => (
          <TaskCard
            key={item.id}
            item={item}
            now={now}
            featured={index === 0 && items.length > 1}
            accentColor={accent}
            onClick={onAssignmentSelect ? () => onAssignmentSelect(item) : undefined}
            onArchive={onAssignmentArchive ? () => onAssignmentArchive(item) : undefined}
          />
        ))}
      </div>
    </section>
  )
}
