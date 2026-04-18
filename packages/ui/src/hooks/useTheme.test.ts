import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { applyTheme, getInitialTheme, initializeTheme } from "./useTheme"

function mockMatchMedia(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe("useTheme helpers", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ""
    document.documentElement.style.colorScheme = ""
    mockMatchMedia(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("reads a persisted dark theme", () => {
    localStorage.setItem("sc-theme", "dark")

    expect(getInitialTheme()).toBe("dark")
  })

  test("applies dark theme classes and color-scheme", () => {
    applyTheme("dark")

    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe("dark")
  })

  test("initializes from persisted dark theme before render", () => {
    localStorage.setItem("sc-theme", "dark")

    const theme = initializeTheme()

    expect(theme).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe("dark")
  })

  test("resolves auto theme from the system preference", () => {
    mockMatchMedia(true)
    localStorage.setItem("sc-theme", "auto")

    initializeTheme()

    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe("dark")
  })
})
