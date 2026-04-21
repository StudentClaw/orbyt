import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  APPLE_BRIDGE_BINARY_NAME,
  createAppleBridgeVersionMetadata,
  resolveAppleBridgePaths,
  stageBuiltAppleBridgeArtifacts,
} from "./build-apple-calendar-bridge"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "student-claw-bridge-build-"))
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

describe("build-apple-calendar-bridge", () => {
  test("resolves per-arch bridge output and build paths", () => {
    const repoRoot = "/repo"

    expect(resolveAppleBridgePaths(repoRoot, "arm64")).toEqual({
      bridgeRoot: "/repo/packages/extensions/apple-calendar-mcp/bridge",
      distDir: "/repo/packages/extensions/apple-calendar-mcp/bridge/dist/arm64",
      outputBinaryPath: `/repo/packages/extensions/apple-calendar-mcp/bridge/dist/arm64/${APPLE_BRIDGE_BINARY_NAME}`,
      outputVersionPath: "/repo/packages/extensions/apple-calendar-mcp/bridge/dist/arm64/version.json",
      swiftTriple: "arm64-apple-macosx13.0",
      scratchPath: "/repo/packages/extensions/apple-calendar-mcp/bridge/.build/student-claw/arm64",
      builtBinaryCandidates: [
        "/repo/packages/extensions/apple-calendar-mcp/bridge/.build/student-claw/arm64/release/CalendarAPIBridge",
        "/repo/packages/extensions/apple-calendar-mcp/bridge/.build/student-claw/arm64/arm64-apple-macosx13.0/release/CalendarAPIBridge",
      ],
    })
    expect(resolveAppleBridgePaths(repoRoot, "x64").swiftTriple).toBe("x86_64-apple-macosx13.0")
  })

  test("emits version metadata that matches the app version", () => {
    expect(createAppleBridgeVersionMetadata("0.1.0", "arm64")).toEqual({
      appVersion: "0.1.0",
      bridgeVersion: "0.1.0",
      arch: "arm64",
    })
  })

  test("stages a built bridge binary and matching version metadata into dist/<arch>", () => {
    const repoRoot = createTempDir()
    const paths = resolveAppleBridgePaths(repoRoot, "arm64")
    const builtBinaryPath = paths.builtBinaryCandidates[0]
    stageBuiltAppleBridgeArtifacts({
      repoRoot,
      arch: "arm64",
      appVersion: "0.1.0",
      builtBinaryPath,
      binaryContents: "arm64-binary",
    })

    expect(existsSync(paths.outputBinaryPath)).toBe(true)
    expect(readFileSync(paths.outputBinaryPath, "utf8")).toBe("arm64-binary")
    expect(JSON.parse(readFileSync(paths.outputVersionPath, "utf8"))).toEqual({
      appVersion: "0.1.0",
      bridgeVersion: "0.1.0",
      arch: "arm64",
    })
  })
})
