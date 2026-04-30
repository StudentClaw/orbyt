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

const LAST_READ_STORAGE_KEY = "orbyt:activity:last-read-at"
const EPOCH_ISO = new Date(0).toISOString()

function readPersistedLastReadAt(): string {
  try {
    if (typeof localStorage === "undefined") return EPOCH_ISO
    return localStorage.getItem(LAST_READ_STORAGE_KEY) ?? EPOCH_ISO
  } catch {
    return EPOCH_ISO
  }
}

function persistLastReadAt(value: string): void {
  try {
    if (typeof localStorage === "undefined") return
    localStorage.setItem(LAST_READ_STORAGE_KEY, value)
  } catch {
    // best-effort; ignore quota/permission failures
  }
}

const activityLastReadAtAtom = createAtom<string>(
  "activity-last-read-at",
  readPersistedLastReadAt(),
)

const activityFilterAtom = createAtom<ActivityFilterCategory>(
  "activity-filter",
  "all",
)

function computeUnreadCount(
  entries: ReadonlyArray<ActivityFeedEntryWithMeta>,
  lastReadAt: string,
): number {
  const cutoff = Date.parse(lastReadAt)
  if (Number.isNaN(cutoff)) return entries.length
  let count = 0
  for (const entry of entries) {
    const ts = Date.parse(entry.receivedAt)
    if (Number.isNaN(ts) || ts > cutoff) count += 1
  }
  return count
}

function syncUnreadCount(): void {
  const entries = appAtomRegistry.get(activityEntriesAtom)
  const lastReadAt = appAtomRegistry.get(activityLastReadAtAtom)
  appAtomRegistry.set(activityUnreadCountAtom, computeUnreadCount(entries, lastReadAt))
}

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
  const now = new Date().toISOString()
  appAtomRegistry.set(activityLastReadAtAtom, now)
  persistLastReadAt(now)
  appAtomRegistry.set(activityUnreadCountAtom, 0)
}

export function setActivityEntries(entries: ReadonlyArray<ActivityFeedEntryWithMeta>): void {
  appAtomRegistry.set(activityEntriesAtom, entries)
  syncUnreadCount()
}

export function removeActivityEntry(id: ActivityFeedEntry["id"]): void {
  const current = appAtomRegistry.get(activityEntriesAtom)
  const next = current.filter((entry) => entry.id !== id)
  if (next.length === current.length) return
  appAtomRegistry.set(activityEntriesAtom, next)
  syncUnreadCount()
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
  }
  syncUnreadCount()
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

  // Hydrate the activity feed from the persisted server state so notifications
  // survive app restarts. We only seed entries that are missing from the
  // current in-memory atom; live push events take precedence.
  void client.activity
    .getFeed()
    .then((entries) => {
      if (disposed) return
      const seeded: ReadonlyArray<ActivityFeedEntryWithMeta> = entries.map((entry) => ({
        ...entry,
        receivedAt: entry.createdAt ?? new Date().toISOString(),
      }))
      // Merge with anything that arrived via push during the request window.
      const current = appAtomRegistry.get(activityEntriesAtom)
      const knownIds = new Set(current.map((e) => e.id))
      const merged = [
        ...current,
        ...seeded.filter((e) => !knownIds.has(e.id)),
      ]
      // Newest first by receivedAt.
      const sorted = [...merged].sort(
        (a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt),
      )
      appAtomRegistry.set(activityEntriesAtom, sorted)
      syncUnreadCount()
    })
    .catch(() => undefined)

  const cleanups = [
    client.activity.onFeedUpdate((event) => {
      if (disposed) return
      applyActivityFeedUpsertEvent(event)
      if (event.notify) {
        // Lazy-import to avoid pulling Electron-only code into headless test paths.
        void import("../lib/nativeNotification.js")
          .then(({ showDesktopNotification }) =>
            showDesktopNotification({
              title: event.title,
              body: event.body ?? "",
            }),
          )
          .catch(() => undefined)
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
  appAtomRegistry.set(activityLastReadAtAtom, EPOCH_ISO)
  appAtomRegistry.set(activityFilterAtom, "all")
}
