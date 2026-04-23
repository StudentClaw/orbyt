import { MORNING_RUN_HOUR, EVENING_RUN_HOUR } from "@orbyt/contracts"

const RUN_HOURS = [MORNING_RUN_HOUR, EVENING_RUN_HOUR] as const

function slotForHour(reference: Date, hour: number): Date {
  const d = new Date(reference)
  d.setHours(hour, 0, 0, 0)
  return d
}

function todaySlots(reference: Date): Date[] {
  return RUN_HOURS.map((h) => slotForHour(reference, h))
}

export function computeNextMemorizeRun(now: Date): Date {
  const upcoming = todaySlots(now).find((s) => s > now)
  if (upcoming) return upcoming
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return slotForHour(tomorrow, MORNING_RUN_HOUR)
}

export function computeMostRecentPassedSlot(now: Date): Date {
  const passed = todaySlots(now).filter((s) => s <= now)
  if (passed.length > 0) return passed[passed.length - 1]!
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  return slotForHour(yesterday, EVENING_RUN_HOUR)
}

export function memorizeRunNeeded(
  lastRunAt: string | null,
  now: Date,
  graphFolderEmpty = false,
): boolean {
  if (graphFolderEmpty) return true
  const mostRecent = computeMostRecentPassedSlot(now)
  if (!lastRunAt) return true
  return new Date(lastRunAt) < mostRecent
}
