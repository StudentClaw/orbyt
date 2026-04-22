import type { Course } from "@student-claw/contracts"
import type { PrioritizedItem } from "./priority-model"
import { TaskCard } from "./TaskCard"

interface SubjectBlockProps {
  readonly course: Course
  readonly items: ReadonlyArray<PrioritizedItem>
  readonly now: Date
  readonly onAssignmentSelect?: (item: PrioritizedItem) => void
}

export function SubjectBlock({ course, items, now, onAssignmentSelect }: SubjectBlockProps) {
  return (
    <section className="mb-10 last:mb-0" data-testid={`subject-block-${course.id}`}>
      <div className="mb-4 flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{course.code}</h2>
        <span className="text-sm text-muted-foreground">{course.name}</span>
        <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
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
