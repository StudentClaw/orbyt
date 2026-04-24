import { FALLBACK_RUN_HOUR } from "@orbyt/contracts"

function slotForHour(reference: Date, hour: number): Date {
  const d = new Date(reference)
  d.setHours(hour, 0, 0, 0)
  return d
}

export function computeNextMemorizeRun(now: Date): Date {
  const today = slotForHour(now, FALLBACK_RUN_HOUR)
  if (today > now) return today
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return slotForHour(tomorrow, FALLBACK_RUN_HOUR)
}

export function computeMostRecentPassedSlot(now: Date): Date {
  const today = slotForHour(now, FALLBACK_RUN_HOUR)
  if (today <= now) return today
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  return slotForHour(yesterday, FALLBACK_RUN_HOUR)
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
