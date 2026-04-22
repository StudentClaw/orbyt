// 3-layer priority model for dashboard priority queue
// Layer 1: Urgency gate (RED / YELLOW / GREEN)
// Layer 2: Impact score (within same zone)
// Layer 3: Effort tiebreaker within ±0.05 epsilon (WSJF)

export interface PrioritizedItem {
  readonly id: string
  readonly title: string
  readonly courseId: string
  readonly courseCode: string
  readonly courseName?: string
  readonly courseColor?: string
  readonly effectiveDueAt: string
  readonly estimatedMinutes: number
  readonly impactScore: number
  readonly coursePriority: number
  readonly pointsPossible?: number
  readonly submissionStatus?: string
  readonly grade?: string
  readonly htmlUrl?: string
  readonly sourceId?: string
}

export type UrgencyZone = "overdue" | "urgent" | "attention" | "calm"

export interface PriorityDisplay {
  readonly zone: UrgencyZone
  readonly label: string
  readonly color: string
  readonly bgColor: string
}

type InternalZone = "RED" | "YELLOW" | "GREEN"

const ZONE_RANK: Record<InternalZone, number> = {
  RED: 0,
  YELLOW: 1,
  GREEN: 2,
}

const IMPACT_EPSILON = 0.05

function hoursRemaining(dueAt: string, now: Date): number {
  return (new Date(dueAt).getTime() - now.getTime()) / (1000 * 60 * 60)
}

function computeInternalZone(item: PrioritizedItem, now: Date): InternalZone {
  const hours = hoursRemaining(item.effectiveDueAt, now)
  const effortHours = item.estimatedMinutes / 60

  if (hours < effortHours * 1.5) return "RED"
  if (hours < 48) return "YELLOW"
  return "GREEN"
}

export function sortByPriority(
  items: ReadonlyArray<PrioritizedItem>,
  now: Date,
): ReadonlyArray<PrioritizedItem> {
  return [...items].sort((a, b) => {
    const zoneA = computeInternalZone(a, now)
    const zoneB = computeInternalZone(b, now)

    // Layer 1: Urgency gate
    const zoneDiff = ZONE_RANK[zoneA] - ZONE_RANK[zoneB]
    if (zoneDiff !== 0) return zoneDiff

    // Within RED zone, sort by earliest deadline
    if (zoneA === "RED") {
      return new Date(a.effectiveDueAt).getTime() - new Date(b.effectiveDueAt).getTime()
    }

    // Layer 2: Impact score (higher first)
    const impactA = a.impactScore * a.coursePriority
    const impactB = b.impactScore * b.coursePriority

    if (Math.abs(impactA - impactB) > IMPACT_EPSILON) {
      return impactB - impactA
    }

    // Layer 3: Effort tiebreaker — shorter effort first (WSJF)
    return a.estimatedMinutes - b.estimatedMinutes
  })
}

export function computePriorityDisplay(
  item: PrioritizedItem,
  now: Date,
): PriorityDisplay {
  const hours = hoursRemaining(item.effectiveDueAt, now)

  if (hours < 0) {
    return { zone: "overdue", label: "Overdue", color: "text-red-600", bgColor: "bg-red-100" }
  }

  const zone = computeInternalZone(item, now)

  switch (zone) {
    case "RED":
      return { zone: "urgent", label: "Urgent", color: "text-orange-600", bgColor: "bg-orange-100" }
    case "YELLOW":
      return { zone: "attention", label: "Attention", color: "text-yellow-600", bgColor: "bg-yellow-100" }
    case "GREEN":
      return { zone: "calm", label: "On Track", color: "text-green-600", bgColor: "bg-green-100" }
  }
}
