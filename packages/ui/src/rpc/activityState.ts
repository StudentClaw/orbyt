import type { ActivityCategory, ActivityFeedEntry } from "@orbyt/contracts"
import type { WsRpcClient } from "./wsRpcClient"
import { appAtomRegistry, createAtom, useAtomValue } from "./atomRegistry"

export type ActivityFilterCategory = "all" | ActivityCategory

export interface ActivityFeedEntryWithMeta extends ActivityFeedEntry {
  readonly receivedAt: string // ISO timestamp, client-side only
}

const activityEntriesAtom = createAtom<ReadonlyArray<ActivityFeedEntryWithMeta>>(
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

export function getActivityEntries(): ReadonlyArray<ActivityFeedEntryWithMeta> {
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

export function setActivityEntries(entries: ReadonlyArray<ActivityFeedEntryWithMeta>): void {
  appAtomRegistry.set(activityEntriesAtom, entries)
  appAtomRegistry.set(activityUnreadCountAtom, entries.length)
}

// --- Event application ---

export function applyActivityFeedUpsertEvent(data: {
  readonly id: ActivityFeedEntry["id"]
  readonly category: ActivityCategory
  readonly type: string
  readonly title: string
  readonly body?: string
  readonly priority?: number
  readonly deepLink?: string
}): void {
  const current = appAtomRegistry.get(activityEntriesAtom)
  const existingIndex = current.findIndex((e) => e.id === data.id)

  if (existingIndex >= 0) {
    const updated = current.map((entry, i) =>
      i === existingIndex
        ? {
            ...entry,
            category: data.category,
            type: data.type,
            title: data.title,
            ...(data.body === undefined ? {} : { body: data.body }),
            ...(data.priority === undefined ? {} : { priority: data.priority }),
            ...(data.deepLink === undefined ? {} : { deepLink: data.deepLink }),
          }
        : entry,
    )
    appAtomRegistry.set(activityEntriesAtom, updated)
  } else {
    const newEntry: ActivityFeedEntryWithMeta = {
      id: data.id,
      category: data.category,
      type: data.type,
      title: data.title,
      ...(data.body === undefined ? {} : { body: data.body }),
      ...(data.priority === undefined ? {} : { priority: data.priority }),
      ...(data.deepLink === undefined ? {} : { deepLink: data.deepLink }),
      receivedAt: new Date().toISOString(),
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
  entries: ReadonlyArray<ActivityFeedEntryWithMeta>,
  filter: ActivityFilterCategory,
): ReadonlyArray<ActivityFeedEntryWithMeta> {
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

export function useActivityEntries(): ReadonlyArray<ActivityFeedEntryWithMeta> {
  return useAtomValue(activityEntriesAtom)
}

export function useActivityUnreadCount(): number {
  return useAtomValue(activityUnreadCountAtom)
}

export function useActivityFilter(): ActivityFilterCategory {
  return useAtomValue(activityFilterAtom)
}

export function useFilteredActivityEntries(): ReadonlyArray<ActivityFeedEntryWithMeta> {
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
