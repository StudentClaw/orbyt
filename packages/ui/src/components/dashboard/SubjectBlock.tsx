import type { Course } from "@orbyt/contracts"
import type { PrioritizedItem } from "./priority-model"
import { TaskCard } from "./TaskCard"
import { courseAccentColor } from "./course-accent"

interface SubjectBlockProps {
  readonly course: Course
  readonly items: ReadonlyArray<PrioritizedItem>
  readonly now: Date
  readonly onAssignmentSelect?: (item: PrioritizedItem) => void
}

export function SubjectBlock({ course, items, now, onAssignmentSelect }: SubjectBlockProps) {
  const accent = courseAccentColor(course.id, course.color)
  return (
    <section className="mb-10 last:mb-0" data-testid={`subject-block-${course.id}`}>
      <div className="mb-4 flex flex-wrap items-baseline gap-2">
        <span
          aria-hidden
          className="h-4 w-1 self-center rounded-sm"
          style={{ backgroundColor: accent }}
        />
        <h2
          className="text-lg font-semibold tracking-tight"
          style={{ color: accent }}
        >
          {course.code}
        </h2>
        <span className="text-sm text-muted-foreground">{course.name}</span>
        <span
          className="rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums"
          style={{
            color: accent,
            borderColor: `color-mix(in oklab, ${accent} 32%, var(--border))`,
            backgroundColor: `color-mix(in oklab, ${accent} 10%, transparent)`,
          }}
        >
          {items.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <TaskCard
            key={item.id}
            item={item}
            now={now}
            onClick={onAssignmentSelect ? () => onAssignmentSelect(item) : undefined}
          />
        ))}
      </div>
    </section>
  )
}
