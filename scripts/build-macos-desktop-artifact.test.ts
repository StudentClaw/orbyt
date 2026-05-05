import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  createBuildLogPath,
  createElectronBuilderArgs,
  createMacPackagingConfig,
  createStagePackageJson,
  detectMacSigningMode,
  resolveGitHubPublishConfig,
  resolvePackagedAppPath,
  stageMacPackagedExtensions,
  verifyAppleBridgeVersion,
} from "./build-macos-desktop-artifact"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-mac-artifact-"))
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
      productName: "Orbyt",
      appId: "com.orbyt.app",
      stageAppDir: "/tmp/orbyt-stage",
      outputDir: "/tmp/orbyt-release",
      signed: true,
    })

    expect(config).toMatchObject({
      appId: "com.orbyt.app",
      productName: "Orbyt",
      electronVersion: "41.1.1",
      directories: {
        output: "/tmp/orbyt-release",
        buildResources: "/tmp/orbyt-stage/build-resources",
      },
      extraResources: [
        {
          from: "/tmp/orbyt-stage/extra-resources/extensions",
          to: "extensions",
        },
        {
          from: "/tmp/orbyt-stage/extra-resources/skills",
          to: "skills",
        },
      ],
      mac: {
        target: ["dmg", "zip"],
        hardenedRuntime: true,
        entitlements: "/tmp/orbyt-stage/build-resources/entitlements.mac.plist",
        entitlementsInherit: "/tmp/orbyt-stage/build-resources/entitlements.mac.inherit.plist",
        binaries: ["/tmp/orbyt-stage/extra-resources/extensions/apple-calendar-mcp/bridge/CalendarAPIBridge"],
        extendInfo: {
          NSCalendarsUsageDescription:
            "Orbyt needs calendar access to read class schedules and help plan study sessions, deadlines, and events.",
          NSCalendarsFullAccessUsageDescription:
            "Orbyt needs full calendar access to create and update study sessions, deadlines, and other events you ask it to manage.",
        },
      },
      afterSign: "/tmp/orbyt-stage/build-resources/notarize.mjs",
    })
  })

  test("adds stable GitHub updater publish metadata when a repository is configured", () => {
    const config = createMacPackagingConfig({
      productName: "Orbyt",
      appId: "com.orbyt.app",
      stageAppDir: "/tmp/orbyt-stage",
      outputDir: "/tmp/orbyt-release",
      signed: true,
      updateRepository: "orbyt/orbyt",
    })

    expect(config).toMatchObject({
      publish: [{
        provider: "github",
        owner: "orbyt",
        repo: "orbyt",
        releaseType: "release",
      }],
    })
  })

  test("ignores invalid updater repository slugs", () => {
    expect(resolveGitHubPublishConfig("invalid")).toBeUndefined()
    expect(resolveGitHubPublishConfig("one/two/three")).toBeUndefined()
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
      productName: "Orbyt",
      arch: "arm64",
      exists: (candidate) => candidate === "/repo/release/mac-arm64/Orbyt.app",
    })).toBe("/repo/release/mac-arm64/Orbyt.app")
  })

  test("resolves the packaged x64 app path from the generic mac release directory", () => {
    expect(resolvePackagedAppPath({
      releaseDir: "/repo/release",
      productName: "Orbyt",
      arch: "x64",
      exists: (candidate) => candidate === "/repo/release/mac/Orbyt.app",
    })).toBe("/repo/release/mac/Orbyt.app")
  })

  test("builds electron-builder args without overriding mac targets to dmg only", () => {
    expect(createElectronBuilderArgs({
      stageAppDir: "/tmp/orbyt-stage",
      arch: "arm64",
      releaseDir: "/tmp/orbyt-release",
    })).toEqual([
      "x",
      "--install=fallback",
      "electron-builder",
      "--projectDir",
      "/tmp/orbyt-stage",
      "--mac",
      "--arm64",
      "--publish",
      "never",
      "--config.directories.output=/tmp/orbyt-release",
    ])
  })

  test("stages the desktop app with the bundled server runtime dependency", () => {
    const packageJson = createStagePackageJson("/tmp/orbyt-stage", true) as {
      dependencies: Record<string, string>
    }

    expect(packageJson.dependencies["@orbyt/server"]).toBe("file:vendor/server")
    expect(packageJson.dependencies["@orbyt/contracts"]).toBe("file:vendor/contracts")
    expect(packageJson.dependencies["electron-updater"]).toBe("^6.6.2")
  })

  test("uses the release app version for staged mac packaging", () => {
    const packageJson = createStagePackageJson("/tmp/orbyt-stage", true, "0.2.1") as {
      version: string
    }

    expect(packageJson.version).toBe("0.2.1")
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
