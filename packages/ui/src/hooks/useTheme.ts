import { useCallback, useEffect, useSyncExternalStore } from "react"

export type Theme = "light" | "dark" | "auto"

const STORAGE_KEY = "sc-theme"
const subscribers = new Set<() => void>()
let systemThemeCleanup: (() => void) | null = null

function isTheme(value: string | null): value is Theme {
  return value === "dark" || value === "light" || value === "auto"
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getStoredTheme(): Theme {
  const storage = getStorage()
  if (!storage) {
    return "auto"
  }

  try {
    const stored = storage.getItem(STORAGE_KEY)
    return isTheme(stored) ? stored : "auto"
  } catch {
    return "auto"
  }
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light"
  }

  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)")
  return mediaQuery?.matches ? "dark" : "light"
}

function getResolvedTheme(theme: Theme): "light" | "dark" {
  return theme === "auto" ? getSystemTheme() : theme
}

export function getInitialTheme(): Theme {
  return getStoredTheme()
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") {
    return
  }

  const resolvedTheme = getResolvedTheme(theme)
  document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
  document.documentElement.style.colorScheme = resolvedTheme
}

function detachSystemThemeListener() {
  if (!systemThemeCleanup) {
    return
  }

  systemThemeCleanup()
  systemThemeCleanup = null
}

function syncSystemThemeListener(theme: Theme) {
  if (theme !== "auto" || typeof window === "undefined") {
    detachSystemThemeListener()
    return
  }

  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)")
  if (!mediaQuery) {
    return
  }

  if (systemThemeCleanup) {
    return
  }

  const handleChange = () => applyTheme("auto")

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange)
    systemThemeCleanup = () => mediaQuery.removeEventListener("change", handleChange)
    return
  }

  mediaQuery.addListener?.(handleChange)
  systemThemeCleanup = () => mediaQuery.removeListener?.(handleChange)
}

function setStoredTheme(theme: Theme) {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore
  }
}

function emitThemeChange() {
  for (const subscriber of subscribers) {
    subscriber()
  }
}

function handleStorageChange(event: StorageEvent) {
  const storage = getStorage()
  if (!storage) {
    return
  }

  if (event.storageArea && event.storageArea !== storage) {
    return
  }

  if (event.key !== null && event.key !== STORAGE_KEY) {
    return
  }

  initializeTheme()
  emitThemeChange()
}

function subscribeToTheme(callback: () => void) {
  subscribers.add(callback)

  if (subscribers.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", handleStorageChange)
  }

  return () => {
    subscribers.delete(callback)

    if (subscribers.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorageChange)
    }
  }
}

function getThemeSnapshot(): Theme {
  return getStoredTheme()
}

export function initializeTheme(): Theme {
  const theme = getInitialTheme()
  applyTheme(theme)
  syncSystemThemeListener(theme)
  return theme
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => "auto")

  useEffect(() => {
    initializeTheme()
  }, [theme])

  const setTheme = useCallback((nextTheme: Theme) => {
    setStoredTheme(nextTheme)
    applyTheme(nextTheme)
    syncSystemThemeListener(nextTheme)
    emitThemeChange()
  }, [])

  return { theme, setTheme }
}
