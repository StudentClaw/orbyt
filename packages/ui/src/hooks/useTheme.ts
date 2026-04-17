import { useState, useEffect, useCallback } from "react"

export type Theme = "light" | "dark" | "auto"

const STORAGE_KEY = "sc-theme"

function getResolvedTheme(theme: Theme): "light" | "dark" {
  if (theme === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }
  return theme
}

export function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "dark" || stored === "light" || stored === "auto") return stored
  } catch {
    // ignore
  }
  return "auto"
}

export function applyTheme(theme: Theme): void {
  const resolvedTheme = getResolvedTheme(theme)
  document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
  document.documentElement.style.colorScheme = resolvedTheme
}

export function initializeTheme(): Theme {
  const theme = getInitialTheme()
  applyTheme(theme)
  return theme
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore
    }

    if (theme === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => applyTheme("auto")
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }
  }, [theme])

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme)
  }, [])

  return { theme, setTheme }
}
