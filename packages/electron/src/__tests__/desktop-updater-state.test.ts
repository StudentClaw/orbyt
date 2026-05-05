import { describe, expect, test } from "bun:test"
import {
  createInitialDesktopUpdateState,
  downloadCompleted,
  getAutoUpdateDisabledReason,
  isStableUpdateVersion,
  updateAvailable,
} from "../updater/update-state"

describe("desktop updater state", () => {
  test("defaults to stable automatic update state when enabled", () => {
    expect(createInitialDesktopUpdateState({
      currentVersion: "0.1.0",
      mode: "automatic",
      enabled: true,
    })).toMatchObject({
      enabled: true,
      mode: "automatic",
      status: "idle",
      currentVersion: "0.1.0",
      message: null,
    })
  })

  test("accepts only stable semver update versions", () => {
    expect(isStableUpdateVersion("0.1.1")).toBe(true)
    expect(isStableUpdateVersion("0.1.1+build.4")).toBe(true)
    expect(isStableUpdateVersion("0.1.1-beta.1")).toBe(false)
    expect(isStableUpdateVersion("0.1.1-nightly.20260428.1")).toBe(false)
  })

  test("reports disabled reasons for unsupported runtime contexts", () => {
    expect(getAutoUpdateDisabledReason({
      isPackaged: false,
      platform: "darwin",
      disabledByEnv: false,
      hasUpdateFeedConfig: true,
    })).toContain("packaged production builds")

    expect(getAutoUpdateDisabledReason({
      isPackaged: true,
      platform: "darwin",
      disabledByEnv: false,
      hasUpdateFeedConfig: false,
    })).toContain("update feed")

    expect(getAutoUpdateDisabledReason({
      isPackaged: true,
      platform: "darwin",
      disabledByEnv: false,
      hasUpdateFeedConfig: true,
    })).toBeNull()
  })

  test("enables packaged Windows and Linux updates when a feed is configured", () => {
    expect(getAutoUpdateDisabledReason({
      isPackaged: true,
      platform: "linux",
      disabledByEnv: false,
      hasUpdateFeedConfig: true,
    })).toBeNull()

    expect(getAutoUpdateDisabledReason({
      isPackaged: true,
      platform: "win32",
      disabledByEnv: false,
      hasUpdateFeedConfig: true,
    })).toBeNull()
  })

  test("marks automatic downloads for install on quit", () => {
    const initial = createInitialDesktopUpdateState({
      currentVersion: "0.1.0",
      mode: "automatic",
      enabled: true,
    })
    const available = updateAvailable(initial, "0.1.1", "2026-04-28T12:00:00.000Z")

    expect(downloadCompleted(available, "0.1.1")).toMatchObject({
      status: "downloaded",
      downloadedVersion: "0.1.1",
      message: "Update downloaded. It will install when Orbyt quits.",
    })
  })
})
