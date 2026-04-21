import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"

export const APPLE_BRIDGE_BINARY_NAME = "CalendarAPIBridge"
const MINIMUM_MACOS_VERSION = "13.0"

export type AppleBridgeArch = "arm64" | "x64"

export type AppleBridgeVersionMetadata = {
  appVersion: string
  bridgeVersion: string
  arch: AppleBridgeArch
}

export function resolveAppleBridgeSwiftTriple(arch: AppleBridgeArch): string {
  return arch === "arm64"
    ? `arm64-apple-macosx${MINIMUM_MACOS_VERSION}`
    : `x86_64-apple-macosx${MINIMUM_MACOS_VERSION}`
}

export function resolveAppleBridgePaths(repoRoot: string, arch: AppleBridgeArch) {
  const bridgeRoot = path.join(repoRoot, "packages", "extensions", "apple-calendar-mcp", "bridge")
  const distDir = path.join(bridgeRoot, "dist", arch)
  const outputBinaryPath = path.join(distDir, APPLE_BRIDGE_BINARY_NAME)
  const outputVersionPath = path.join(distDir, "version.json")
  const swiftTriple = resolveAppleBridgeSwiftTriple(arch)
  const scratchPath = path.join(bridgeRoot, ".build", "student-claw", arch)

  return {
    bridgeRoot,
    distDir,
    outputBinaryPath,
    outputVersionPath,
    swiftTriple,
    scratchPath,
    builtBinaryCandidates: [
      path.join(scratchPath, "release", APPLE_BRIDGE_BINARY_NAME),
      path.join(scratchPath, swiftTriple, "release", APPLE_BRIDGE_BINARY_NAME),
    ],
  }
}

export function createAppleBridgeVersionMetadata(appVersion: string, arch: AppleBridgeArch): AppleBridgeVersionMetadata {
  return {
    appVersion,
    bridgeVersion: appVersion,
    arch,
  }
}

function writeBridgeVersionMetadata(outputVersionPath: string, metadata: AppleBridgeVersionMetadata): void {
  writeFileSync(outputVersionPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8")
}

function resolveBuiltAppleBridgeBinary(paths: ReturnType<typeof resolveAppleBridgePaths>): string {
  const candidate = paths.builtBinaryCandidates.find(existsSync)
  if (!candidate) {
    throw new Error(`Apple Calendar bridge build did not produce ${APPLE_BRIDGE_BINARY_NAME} for ${paths.swiftTriple}`)
  }
  return candidate
}

export function stageBuiltAppleBridgeArtifacts(options: {
  repoRoot: string
  arch: AppleBridgeArch
  appVersion: string
  builtBinaryPath: string
  binaryContents?: string | Buffer
}): void {
  const paths = resolveAppleBridgePaths(options.repoRoot, options.arch)
  mkdirSync(paths.distDir, { recursive: true })

  if (options.binaryContents !== undefined) {
    mkdirSync(path.dirname(options.builtBinaryPath), { recursive: true })
    writeFileSync(options.builtBinaryPath, options.binaryContents)
  }

  cpSync(options.builtBinaryPath, paths.outputBinaryPath)
  writeBridgeVersionMetadata(paths.outputVersionPath, createAppleBridgeVersionMetadata(options.appVersion, options.arch))
}

export function verifyAppleBridgeVersionMetadata(versionPath: string, appVersion: string): AppleBridgeVersionMetadata {
  const metadata = JSON.parse(readFileSync(versionPath, "utf8")) as AppleBridgeVersionMetadata
  if (metadata.appVersion !== appVersion || metadata.bridgeVersion !== appVersion) {
    throw new Error(`Apple Calendar bridge metadata does not match app version ${appVersion}`)
  }
  return metadata
}

function resolveHostArch(): AppleBridgeArch {
  return process.arch === "arm64" ? "arm64" : "x64"
}

function runSwiftBuild(paths: ReturnType<typeof resolveAppleBridgePaths>, verbose: boolean): void {
  const result = spawnSync("swift", [
    "build",
    "-c",
    "release",
    "--scratch-path",
    paths.scratchPath,
    "--triple",
    paths.swiftTriple,
  ], {
    cwd: paths.bridgeRoot,
    stdio: verbose ? "inherit" : "pipe",
    env: process.env,
  })

  if (result.status !== 0) {
    throw new Error(
      result.stderr?.toString("utf8").trim()
        || result.stdout?.toString("utf8").trim()
        || `swift build failed for ${paths.swiftTriple}`,
    )
  }
}

export function buildAppleCalendarBridge(options: {
  repoRoot: string
  arch: AppleBridgeArch
  appVersion: string
  verbose?: boolean
}): ReturnType<typeof resolveAppleBridgePaths> {
  const paths = resolveAppleBridgePaths(options.repoRoot, options.arch)
  rmSync(paths.distDir, { recursive: true, force: true })
  mkdirSync(paths.distDir, { recursive: true })
  runSwiftBuild(paths, options.verbose ?? false)
  const builtBinaryPath = resolveBuiltAppleBridgeBinary(paths)
  stageBuiltAppleBridgeArtifacts({
    repoRoot: options.repoRoot,
    arch: options.arch,
    appVersion: options.appVersion,
    builtBinaryPath,
  })
  return paths
}

if (import.meta.main) {
  const repoRoot = path.resolve(import.meta.dir, "..")
  const archArg = process.argv.includes("--arch")
    ? process.argv[process.argv.indexOf("--arch") + 1]
    : undefined
  const appVersionArg = process.argv.includes("--app-version")
    ? process.argv[process.argv.indexOf("--app-version") + 1]
    : undefined
  const arch = (archArg === "arm64" || archArg === "x64" ? archArg : resolveHostArch()) as AppleBridgeArch
  const appVersion = appVersionArg ?? process.env.STUDENT_CLAW_APP_VERSION ?? "0.1.0"
  const verbose = process.argv.includes("--verbose")
  const paths = buildAppleCalendarBridge({
    repoRoot,
    arch,
    appVersion,
    verbose,
  })
  process.stdout.write(`Built Apple Calendar bridge for ${arch}: ${paths.outputBinaryPath}\n`)
}
