import type { ActivityCategory, ActivityFeedEntry } from "@student-claw/contracts"
import type { WsRpcClient } from "./wsRpcClient"
import { appAtomRegistry, createAtom, useAtomValue } from "./atomRegistry"

export type ActivityFilterCategory = "all" | ActivityCategory

const activityEntriesAtom = createAtom<ReadonlyArray<ActivityFeedEntry>>(
  "activity-entries",
  [],
)

const activityUnreadCountAtom = createAtom<number>(
  "activity-unread-count",
  0,
)

const activityFilterAtom = createAtom<ActivityFilterCategory>(
  "activity-filter",
  "all",
)

// --- Imperative getters/setters ---

export function getActivityEntries(): ReadonlyArray<ActivityFeedEntry> {
  return appAtomRegistry.get(activityEntriesAtom)
}

export function getActivityUnreadCount(): number {
  return appAtomRegistry.get(activityUnreadCountAtom)
}

export function getActivityFilter(): ActivityFilterCategory {
  return appAtomRegistry.get(activityFilterAtom)
}

export function setActivityFilter(filter: ActivityFilterCategory): void {
  appAtomRegistry.set(activityFilterAtom, filter)
}

export function markAllActivityRead(): void {
  appAtomRegistry.set(activityUnreadCountAtom, 0)
}

// --- Event application ---

export function applyActivityFeedUpsertEvent(data: {
  readonly entryId: string
  readonly title: string
  readonly category: string
}): void {
  const current = appAtomRegistry.get(activityEntriesAtom)
  const existingIndex = current.findIndex((e) => e.id === data.entryId)

  if (existingIndex >= 0) {
    const updated = current.map((entry, i) =>
      i === existingIndex
        ? { ...entry, title: data.title, category: data.category as ActivityCategory }
        : entry,
    )
    appAtomRegistry.set(activityEntriesAtom, updated)
  } else {
    const newEntry: ActivityFeedEntry = {
      id: data.entryId as ActivityFeedEntry["id"],
      category: data.category as ActivityCategory,
      type: data.category,
      title: data.title,
    }
    appAtomRegistry.set(activityEntriesAtom, [newEntry, ...current])
    appAtomRegistry.set(
      activityUnreadCountAtom,
      appAtomRegistry.get(activityUnreadCountAtom) + 1,
    )
  }
}

// --- Pure derivation functions ---

export function filterActivityEntries(
  entries: ReadonlyArray<ActivityFeedEntry>,
  filter: ActivityFilterCategory,
): ReadonlyArray<ActivityFeedEntry> {
  if (filter === "all") return entries
  return entries.filter((e) => e.category === filter)
}

// --- Sync starter ---

export function startActivityStateSync(client: WsRpcClient): () => void {
  let disposed = false

  const cleanups = [
    client.activity.onFeedUpdate((event) => {
      if (!disposed) {
        applyActivityFeedUpsertEvent(event)
      }
    }),
  ]

  return () => {
    disposed = true
    for (const cleanup of cleanups) {
      cleanup()
    }
  }
}

// --- React hooks ---

export function useActivityEntries(): ReadonlyArray<ActivityFeedEntry> {
  return useAtomValue(activityEntriesAtom)
}

export function useActivityUnreadCount(): number {
  return useAtomValue(activityUnreadCountAtom)
}

export function useActivityFilter(): ActivityFilterCategory {
  return useAtomValue(activityFilterAtom)
}

export function useFilteredActivityEntries(): ReadonlyArray<ActivityFeedEntry> {
  return useAtomValue(activityEntriesAtom, (entries) =>
    filterActivityEntries(entries, appAtomRegistry.get(activityFilterAtom)),
  )
}

// --- Test reset ---

export function resetActivityStateForTests(): void {
  appAtomRegistry.set(activityEntriesAtom, [])
  appAtomRegistry.set(activityUnreadCountAtom, 0)
  appAtomRegistry.set(activityFilterAtom, "all")
}
