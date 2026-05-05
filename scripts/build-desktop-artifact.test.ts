import { describe, expect, test } from "bun:test"
import {
  createDesktopElectronBuilderArgs,
  createDesktopPackagingConfig,
  createDesktopStagePackageJson,
} from "./build-desktop-artifact"

describe("build-desktop-artifact", () => {
  test("generates Linux AppImage packaging config with staged resources", () => {
    const config = createDesktopPackagingConfig({
      platform: "linux",
      target: "AppImage",
      stageAppDir: "/tmp/orbyt-stage",
      outputDir: "/tmp/orbyt-release",
      signed: false,
    })

    expect(config).toMatchObject({
      appId: "com.orbyt.app",
      productName: "Orbyt",
      artifactName: "Orbyt-${version}-${arch}.${ext}",
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
      linux: {
        target: ["AppImage"],
        executableName: "orbyt",
        icon: "icon.png",
        category: "Education",
      },
    })
  })

  test("generates unsigned Windows NSIS packaging config", () => {
    const config = createDesktopPackagingConfig({
      platform: "win",
      target: "nsis",
      stageAppDir: "/tmp/orbyt-stage",
      outputDir: "/tmp/orbyt-release",
      signed: false,
    })

    expect(config).toMatchObject({
      npmRebuild: false,
      win: {
        target: ["nsis"],
        signAndEditExecutable: false,
      },
    })
  })

  test("builds electron-builder args for non-mac desktop platforms", () => {
    expect(createDesktopElectronBuilderArgs({
      stageAppDir: "/tmp/orbyt-stage",
      platform: "linux",
      arch: "x64",
      releaseDir: "/tmp/orbyt-release",
    })).toEqual([
      "x",
      "--install=fallback",
      "electron-builder",
      "--projectDir",
      "/tmp/orbyt-stage",
      "--linux",
      "--x64",
      "--publish",
      "never",
      "--config.directories.output=/tmp/orbyt-release",
    ])

    expect(createDesktopElectronBuilderArgs({
      stageAppDir: "/tmp/orbyt-stage",
      platform: "win",
      arch: "x64",
      releaseDir: "/tmp/orbyt-release",
    })).toContain("--win")
  })

  test("staged package manifest keeps runtime dependencies and omits mac bridge binaries for non-mac builds", () => {
    const packageJson = createDesktopStagePackageJson({
      platform: "linux",
      target: "AppImage",
      stageAppDir: "/tmp/orbyt-stage",
      signed: false,
    }) as {
      build: {
        mac?: unknown
        linux?: unknown
        extraResources?: { from: string; to: string }[]
      }
      dependencies: Record<string, string>
    }

    expect(packageJson.dependencies["@orbyt/server"]).toBe("file:vendor/server")
    expect(packageJson.dependencies["@orbyt/contracts"]).toBe("file:vendor/contracts")
    expect(packageJson.dependencies["electron-updater"]).toBe("^6.6.2")
    expect(packageJson.build.mac).toBeUndefined()
    expect(JSON.stringify(packageJson.build.extraResources)).not.toContain("CalendarAPIBridge")
  })
})
