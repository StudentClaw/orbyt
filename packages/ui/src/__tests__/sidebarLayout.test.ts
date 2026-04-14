import { describe, expect, test } from "vitest"
import {
  clampDesktopSidebarWidth,
  DEFAULT_DESKTOP_SIDEBAR_WIDTH,
  MAX_DESKTOP_SIDEBAR_WIDTH,
  MIN_DESKTOP_SIDEBAR_WIDTH,
  persistDesktopSidebarWidth,
  readDesktopSidebarWidth,
} from "../lib/sidebarLayout"

function createStorage(initialValue?: string, shouldThrow = false): Storage {
  let value = initialValue ?? null

  return {
    get length() {
      return value === null ? 0 : 1
    },
    clear() {
      value = null
    },
    getItem() {
      if (shouldThrow) {
        throw new Error("Storage unavailable")
      }
      return value
    },
    key() {
      return null
    },
    removeItem() {
      value = null
    },
    setItem(_key: string, nextValue: string) {
      if (shouldThrow) {
        throw new Error("Storage unavailable")
      }
      value = nextValue
    },
  } as Storage
}

describe("sidebarLayout", () => {
  test("clamps sidebar width to the approved desktop range", () => {
    expect(clampDesktopSidebarWidth(120)).toBe(MIN_DESKTOP_SIDEBAR_WIDTH)
    expect(clampDesktopSidebarWidth(320)).toBe(320)
    expect(clampDesktopSidebarWidth(900)).toBe(MAX_DESKTOP_SIDEBAR_WIDTH)
  })

  test("falls back to the default width when persisted storage is missing or invalid", () => {
    expect(readDesktopSidebarWidth(createStorage())).toBe(DEFAULT_DESKTOP_SIDEBAR_WIDTH)
    expect(readDesktopSidebarWidth(createStorage("not-a-number"))).toBe(DEFAULT_DESKTOP_SIDEBAR_WIDTH)
  })

  test("restores and persists a valid clamped width", () => {
    const storage = createStorage()

    expect(persistDesktopSidebarWidth(361.7, storage)).toBe(362)
    expect(readDesktopSidebarWidth(storage)).toBe(362)
  })

  test("gracefully handles storage failures", () => {
    const storage = createStorage(undefined, true)

    expect(readDesktopSidebarWidth(storage)).toBe(DEFAULT_DESKTOP_SIDEBAR_WIDTH)
    expect(persistDesktopSidebarWidth(420, storage)).toBe(420)
  })
})
