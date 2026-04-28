import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { DesktopUpdateSettingsStore } from "../updater/update-settings"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-update-settings-"))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe("DesktopUpdateSettingsStore", () => {
  test("defaults to automatic mode", () => {
    expect(new DesktopUpdateSettingsStore(createTempDir()).read()).toEqual({
      mode: "automatic",
    })
  })

  test("persists prompt mode", () => {
    const store = new DesktopUpdateSettingsStore(createTempDir())
    store.write({ mode: "prompt" })

    expect(store.read()).toEqual({
      mode: "prompt",
    })
  })

  test("normalizes invalid settings back to automatic", () => {
    const dir = createTempDir()
    writeFileSync(path.join(dir, "desktop-update-settings.json"), JSON.stringify({ mode: "nightly" }))

    expect(new DesktopUpdateSettingsStore(dir).read()).toEqual({
      mode: "automatic",
    })
  })
})
