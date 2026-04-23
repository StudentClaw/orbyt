const DESKTOP_SIDEBAR_WIDTH_STORAGE_KEY = "orbyt:desktop-sidebar-width"

export const MIN_DESKTOP_SIDEBAR_WIDTH = 240
export const DEFAULT_DESKTOP_SIDEBAR_WIDTH = 420
export const MAX_DESKTOP_SIDEBAR_WIDTH = 480

type StorageLike = Pick<Storage, "getItem" | "setItem">

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function clampDesktopSidebarWidth(width: number): number {
  if (!isFiniteNumber(width)) {
    return DEFAULT_DESKTOP_SIDEBAR_WIDTH
  }

  return Math.min(MAX_DESKTOP_SIDEBAR_WIDTH, Math.max(MIN_DESKTOP_SIDEBAR_WIDTH, Math.round(width)))
}

export function readDesktopSidebarWidth(storage?: StorageLike | null): number {
  const targetStorage = storage ?? (typeof window === "undefined" ? null : window.localStorage)
  if (!targetStorage) {
    return DEFAULT_DESKTOP_SIDEBAR_WIDTH
  }

  try {
    const raw = targetStorage.getItem(DESKTOP_SIDEBAR_WIDTH_STORAGE_KEY)
    if (!raw) {
      return DEFAULT_DESKTOP_SIDEBAR_WIDTH
    }

    return clampDesktopSidebarWidth(Number.parseFloat(raw))
  } catch {
    return DEFAULT_DESKTOP_SIDEBAR_WIDTH
  }
}

export function persistDesktopSidebarWidth(width: number, storage?: StorageLike | null): number {
  const clampedWidth = clampDesktopSidebarWidth(width)
  const targetStorage = storage ?? (typeof window === "undefined" ? null : window.localStorage)

  if (!targetStorage) {
    return clampedWidth
  }

  try {
    targetStorage.setItem(DESKTOP_SIDEBAR_WIDTH_STORAGE_KEY, String(clampedWidth))
  } catch {
    // Ignore storage failures and fall back to the in-memory width.
  }

  return clampedWidth
}
