import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  createBuildLogPath,
  createMacPackagingConfig,
  createStagePackageJson,
  detectMacSigningMode,
  resolvePackagedAppPath,
  stageMacPackagedExtensions,
  verifyAppleBridgeVersion,
} from "./build-macos-desktop-artifact"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "student-claw-mac-artifact-"))
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

describe("build-macos-desktop-artifact", () => {
  test("generates mac packaging config with Calendar usage strings and entitlements", () => {
    const config = createMacPackagingConfig({
      productName: "Student Claw",
      appId: "com.studentclaw.app",
      stageAppDir: "/tmp/student-claw-stage",
      outputDir: "/tmp/student-claw-release",
      signed: true,
    })

    expect(config).toMatchObject({
      appId: "com.studentclaw.app",
      productName: "Student Claw",
      electronVersion: "41.1.1",
      directories: {
        output: "/tmp/student-claw-release",
        buildResources: "/tmp/student-claw-stage/build-resources",
      },
      extraResources: [
        {
          from: "/tmp/student-claw-stage/extra-resources/extensions",
          to: "extensions",
        },
      ],
      mac: {
        target: ["dmg", "zip"],
        hardenedRuntime: true,
        entitlements: "/tmp/student-claw-stage/build-resources/entitlements.mac.plist",
        entitlementsInherit: "/tmp/student-claw-stage/build-resources/entitlements.mac.inherit.plist",
        binaries: ["/tmp/student-claw-stage/extra-resources/extensions/apple-calendar-mcp/bridge/CalendarAPIBridge"],
        extendInfo: {
          NSCalendarsUsageDescription:
            "Student Claw needs calendar access to read class schedules and help plan study sessions, deadlines, and events.",
          NSCalendarsFullAccessUsageDescription:
            "Student Claw needs full calendar access to create and update study sessions, deadlines, and other events you ask it to manage.",
        },
      },
      afterSign: "/tmp/student-claw-stage/build-resources/notarize.mjs",
    })
  })

  test("enables signed packaging only when all mac signing secrets are present", () => {
    expect(detectMacSigningMode({
      CSC_LINK: "https://example.com/cert.p12",
      CSC_KEY_PASSWORD: "secret",
      APPLE_API_KEY: "/tmp/AuthKey_TEST.p8",
      APPLE_API_KEY_ID: "ABC123DEF4",
      APPLE_API_ISSUER: "12345678-1234-1234-1234-123456789012",
    })).toEqual({
      signed: true,
      missing: [],
    })

    expect(detectMacSigningMode({
      CSC_LINK: "https://example.com/cert.p12",
      CSC_KEY_PASSWORD: "secret",
    })).toEqual({
      signed: false,
      missing: ["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"],
    })
  })

  test("creates a timestamped build log path per artifact run", () => {
    expect(createBuildLogPath({
      repoRoot: "/repo",
      arch: "arm64",
      signed: true,
      now: new Date(2026, 3, 21, 12, 34, 56),
    })).toBe("/repo/build-logs/mac-desktop-artifact-20260421-123456-arm64-signed.log")
  })

  test("resolves the packaged app path from the arch-specific release directory", () => {
    expect(resolvePackagedAppPath({
      releaseDir: "/repo/release",
      productName: "Student Claw",
      arch: "arm64",
      exists: (candidate) => candidate === "/repo/release/mac-arm64/Student Claw.app",
    })).toBe("/repo/release/mac-arm64/Student Claw.app")
  })

  test("stages the desktop app with the bundled server runtime dependency", () => {
    const packageJson = createStagePackageJson("/tmp/student-claw-stage", true) as {
      dependencies: Record<string, string>
    }

    expect(packageJson.dependencies["@student-claw/server"]).toBe("file:vendor/server")
    expect(packageJson.dependencies["@student-claw/contracts"]).toBe("file:vendor/contracts")
  })

  test("stages the matching per-arch Apple bridge into packaged extensions", () => {
    const repoRoot = createTempDir()
    const extensionsRoot = path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions")
    const packagedBridgeDir = path.join(extensionsRoot, "apple-calendar-mcp", "bridge")
    const builtBridgeDir = path.join(repoRoot, "packages", "extensions", "apple-calendar-mcp", "bridge", "dist", "arm64")
    mkdirSync(packagedBridgeDir, { recursive: true })
    mkdirSync(builtBridgeDir, { recursive: true })
    writeFileSync(path.join(builtBridgeDir, "CalendarAPIBridge"), "arm64-binary")
    writeFileSync(path.join(builtBridgeDir, "version.json"), JSON.stringify({
      appVersion: "0.1.0",
      bridgeVersion: "0.1.0",
      arch: "arm64",
    }, null, 2))

    stageMacPackagedExtensions({
      repoRoot,
      arch: "arm64",
      appVersion: "0.1.0",
    })

    expect(readFileSync(path.join(packagedBridgeDir, "CalendarAPIBridge"), "utf8")).toBe("arm64-binary")
    expect(JSON.parse(readFileSync(path.join(packagedBridgeDir, "version.json"), "utf8"))).toEqual({
      appVersion: "0.1.0",
      bridgeVersion: "0.1.0",
      arch: "arm64",
    })
  })

  test("fails bridge version verification when packaged metadata drifts from the app version", () => {
    const repoRoot = createTempDir()
    const versionPath = path.join(
      repoRoot,
      "packages",
      "extensions",
      "apple-calendar-mcp",
      "bridge",
      "dist",
      "arm64",
      "version.json",
    )
    mkdirSync(path.dirname(versionPath), { recursive: true })
    writeFileSync(versionPath, JSON.stringify({
      appVersion: "0.0.9",
      bridgeVersion: "0.0.9",
      arch: "arm64",
    }, null, 2))

    expect(() => verifyAppleBridgeVersion({
      repoRoot,
      arch: "arm64",
      appVersion: "0.1.0",
    })).toThrow("Apple Calendar bridge metadata does not match app version 0.1.0")
    expect(existsSync(versionPath)).toBe(true)
  })
})
