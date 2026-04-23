import { describe, expect, test } from "bun:test"
import {
  createMacArtifactVerificationCommands,
  resolveMacArtifactPaths,
  verifyMacArtifactLayout,
} from "./verify-macos-desktop-artifact"

describe("verify-macos-desktop-artifact", () => {
  test("resolves the packaged app and helper paths from the release directory", () => {
    expect(resolveMacArtifactPaths({
      releaseDir: "/tmp/orbyt-release",
      productName: "Orbyt",
    })).toEqual({
      appPath: "/tmp/orbyt-release/Orbyt.app",
      helperPath: "/tmp/orbyt-release/Orbyt.app/Contents/Resources/extensions/apple-calendar-mcp/bridge/CalendarAPIBridge",
    })
  })

  test("builds the signed verification command plan", () => {
    expect(createMacArtifactVerificationCommands({
      appPath: "/tmp/orbyt-release/Orbyt.app",
      helperPath: "/tmp/orbyt-release/Orbyt.app/Contents/Resources/extensions/apple-calendar-mcp/bridge/CalendarAPIBridge",
    })).toEqual([
      ["codesign", ["--verify", "--deep", "--strict", "--verbose=2", "/tmp/orbyt-release/Orbyt.app"]],
      ["codesign", ["--verify", "--deep", "--strict", "--verbose=2", "/tmp/orbyt-release/Orbyt.app/Contents/Resources/extensions/apple-calendar-mcp/bridge/CalendarAPIBridge"]],
      ["spctl", ["--assess", "--type", "execute", "/tmp/orbyt-release/Orbyt.app"]],
      ["xcrun", ["stapler", "validate", "/tmp/orbyt-release/Orbyt.app"]],
    ])
  })

  test("requires the helper outside asar", () => {
    expect(() => verifyMacArtifactLayout({
      appPath: "/tmp/orbyt-release/Orbyt.app",
      helperPath: "/tmp/orbyt-release/Orbyt.app/Contents/Resources/app.asar/extensions/apple-calendar-mcp/bridge/CalendarAPIBridge",
      exists: () => true,
    })).toThrow("Apple Calendar bridge must live outside app.asar")
  })

  test("fails when the app or helper is missing", () => {
    expect(() => verifyMacArtifactLayout({
      appPath: "/tmp/orbyt-release/Orbyt.app",
      helperPath: "/tmp/orbyt-release/Orbyt.app/Contents/Resources/extensions/apple-calendar-mcp/bridge/CalendarAPIBridge",
      exists: (candidate) => candidate === "/tmp/orbyt-release/Orbyt.app",
    })).toThrow("Missing Apple Calendar packaged bridge")
  })
})
