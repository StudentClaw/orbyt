import { appendFileSync, cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import rootPackageJson from "../package.json" with { type: "json" }
import electronPackageJson from "../packages/electron/package.json" with { type: "json" }
import contractsPackageJson from "../packages/contracts/package.json" with { type: "json" }
import serverPackageJson from "../packages/server/package.json" with { type: "json" }
import sharedPackageJson from "../packages/shared/package.json" with { type: "json" }
import sharedRuntimePackageJson from "../packages/shared-runtime/package.json" with { type: "json" }
import {
  APPLE_BRIDGE_BINARY_NAME,
  type AppleBridgeArch,
  verifyAppleBridgeVersionMetadata,
} from "./build-apple-calendar-bridge"
import { resolvePackagedAppleCalendarBridgePathsFromApp } from "../packages/electron/src/plugins/apple-calendar-bridge-paths.js"

const ORBYT_APP_ID = "com.orbyt.app"
const ORBYT_PRODUCT_NAME = "Orbyt"
const CALENDAR_USAGE_DESCRIPTION =
  "Orbyt needs calendar access to read class schedules and help plan study sessions, deadlines, and events."
const CALENDAR_FULL_ACCESS_DESCRIPTION =
  "Orbyt needs full calendar access to create and update study sessions, deadlines, and other events you ask it to manage."

type BuildLogger = {
  readonly logPath: string
  phase: (message: string) => void
  info: (message: string) => void
  command: (command: string, args: string[], cwd: string) => void
  output: (text: string) => void
}

export function detectMacSigningMode(env: Record<string, string | undefined>): {
  signed: boolean
  missing: string[]
} {
  const required = ["CSC_LINK", "CSC_KEY_PASSWORD", "APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"]
  const missing = required.filter((key) => {
    const value = env[key]
    return !value || value.trim().length === 0
  })

  return {
    signed: missing.length === 0,
    missing,
  }
}

export function createMacPackagingConfig(options: {
  productName: string
  appId: string
  stageAppDir: string
  outputDir: string
  signed: boolean
  afterSignPath?: string
}) {
  return {
    appId: options.appId,
    productName: options.productName,
    electronVersion: String(electronPackageJson.dependencies.electron).replace(/^[^\d]*/, ""),
    artifactName: "Orbyt-${version}-${arch}.${ext}",
    directories: {
      output: options.outputDir,
      buildResources: path.join(options.stageAppDir, "build-resources"),
    },
    files: [
      "dist/**/*",
      "node_modules/**/*",
      "package.json",
    ],
    extraResources: [
      {
        from: path.join(options.stageAppDir, "extra-resources", "extensions"),
        to: "extensions",
      },
      {
        from: path.join(options.stageAppDir, "extra-resources", "skills"),
        to: "skills",
      },
    ],
    afterSign: options.afterSignPath ?? path.join(options.stageAppDir, "build-resources", "notarize.mjs"),
    mac: {
      target: ["dmg", "zip"],
      category: "public.app-category.education",
      icon: path.join(options.stageAppDir, "build-resources", "icon.icns"),
      hardenedRuntime: true,
      gatekeeperAssess: false,
      entitlements: path.join(options.stageAppDir, "build-resources", "entitlements.mac.plist"),
      entitlementsInherit: path.join(options.stageAppDir, "build-resources", "entitlements.mac.inherit.plist"),
      binaries: [
        path.join(
          options.stageAppDir,
          "extra-resources",
          "extensions",
          "apple-calendar-mcp",
          "bridge",
          APPLE_BRIDGE_BINARY_NAME,
        ),
      ],
      extendInfo: {
        NSCalendarsUsageDescription: CALENDAR_USAGE_DESCRIPTION,
        NSCalendarsFullAccessUsageDescription: CALENDAR_FULL_ACCESS_DESCRIPTION,
      },
      identity: options.signed ? undefined : null,
    },
  }
}

function resolveRepoRoot(): string {
  return path.resolve(import.meta.dir, "..")
}

function resolveBuildLogsDir(repoRoot: string): string {
  return path.join(repoRoot, "build-logs")
}

function formatBuildTimestamp(date: Date): string {
  const parts = [
    date.getFullYear().toString(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ]

  return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}${parts[5]}`
}

export function createBuildLogPath(options: {
  repoRoot: string
  arch: AppleBridgeArch
  signed: boolean
  now?: Date
}): string {
  const suffix = options.signed ? "signed" : "unsigned"
  return path.join(
    resolveBuildLogsDir(options.repoRoot),
    `mac-desktop-artifact-${formatBuildTimestamp(options.now ?? new Date())}-${options.arch}-${suffix}.log`,
  )
}

function createBuildLogger(options: {
  repoRoot: string
  arch: AppleBridgeArch
  signed: boolean
  verbose: boolean
}): BuildLogger {
  const logPath = createBuildLogPath(options)
  mkdirSync(path.dirname(logPath), { recursive: true })
  writeFileSync(logPath, "", "utf8")

  const writeLine = (line: string, echo = true) => {
    appendFileSync(logPath, `${line}\n`, "utf8")
    if (echo) {
      process.stdout.write(`${line}\n`)
    }
  }

  writeLine(`[build] Orbyt macOS artifact build started (${options.arch}, ${options.signed ? "signed" : "unsigned"})`)

  return {
    logPath,
    phase(message) {
      writeLine(`[phase] ${message}`)
    },
    info(message) {
      writeLine(`[info] ${message}`)
    },
    command(command, args, cwd) {
      writeLine(`[command] (${cwd}) ${command} ${args.join(" ")}`)
    },
    output(text) {
      if (text.trim().length === 0) {
        return
      }

      appendFileSync(logPath, `${text.endsWith("\n") ? text : `${text}\n`}`, "utf8")
      if (options.verbose) {
        process.stdout.write(text.endsWith("\n") ? text : `${text}\n`)
      }
    },
  }
}

function resolveBuildResourcesSource(repoRoot: string): string {
  return path.join(repoRoot, "packages", "electron", "build-resources")
}

function resolveElectronResourcesSource(repoRoot: string): string {
  return path.join(repoRoot, "packages", "electron", "resources")
}

function resolveElectronDistSource(repoRoot: string): string {
  return path.join(repoRoot, "packages", "electron", "dist")
}

function resolveStagedExtensionsSource(repoRoot: string): string {
  return path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions")
}

function resolveStagedSkillsSource(repoRoot: string): string {
  return path.join(repoRoot, "packages", "electron", "dist", "resources", "skills")
}

export function resolvePackagedAppPath(options: {
  releaseDir: string
  productName: string
  arch: AppleBridgeArch
  exists?: (candidate: string) => boolean
}): string {
  const exists = options.exists ?? existsSync
  const candidates = [
    path.join(options.releaseDir, `${options.productName}.app`),
    path.join(options.releaseDir, `mac-${options.arch}`, `${options.productName}.app`),
    path.join(options.releaseDir, "mac", `${options.productName}.app`),
    path.join(options.releaseDir, "mas-universal", `${options.productName}.app`),
  ]

  return candidates.find((candidate) => exists(candidate)) ?? candidates[1]
}

function resolveBridgeDistArchDir(repoRoot: string, arch: AppleBridgeArch): string {
  return path.join(repoRoot, "packages", "extensions", "apple-calendar-mcp", "bridge", "dist", arch)
}

function runCommand(command: string, args: string[], options: {
  cwd: string
  verbose?: boolean
  env?: NodeJS.ProcessEnv
  logger?: BuildLogger
}): void {
  options.logger?.command(command, args, options.cwd)
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: "pipe",
  })
  const stdout = result.stdout?.toString("utf8") ?? ""
  const stderr = result.stderr?.toString("utf8") ?? ""
  options.logger?.output(stdout)
  options.logger?.output(stderr)

  if (result.status !== 0) {
    throw new Error(
      stderr.trim()
        || stdout.trim()
        || `${command} ${args.join(" ")} failed`,
    )
  }
}

function createMacIcon(stageBuildResourcesDir: string, iconPngPath: string, verbose: boolean, logger?: BuildLogger): void {
  const iconsetDir = path.join(stageBuildResourcesDir, "icon.iconset")
  mkdirSync(iconsetDir, { recursive: true })

  for (const size of [16, 32, 128, 256, 512] as const) {
    runCommand("sips", ["-z", String(size), String(size), iconPngPath, "--out", path.join(iconsetDir, `icon_${size}x${size}.png`)], {
      cwd: stageBuildResourcesDir,
      verbose,
      logger,
    })
    const retina = size * 2
    runCommand("sips", ["-z", String(retina), String(retina), iconPngPath, "--out", path.join(iconsetDir, `icon_${size}x${size}@2x.png`)], {
      cwd: stageBuildResourcesDir,
      verbose,
      logger,
    })
  }

  runCommand("iconutil", ["-c", "icns", iconsetDir, "-o", path.join(stageBuildResourcesDir, "icon.icns")], {
    cwd: stageBuildResourcesDir,
    verbose,
    logger,
  })
}

function ensureFullXcode(verbose: boolean, logger?: BuildLogger): void {
  runCommand("xcodebuild", ["-version"], {
    cwd: resolveRepoRoot(),
    verbose,
    logger,
  })
}

function resolvePackagedBridgePaths(repoRoot: string, arch: AppleBridgeArch) {
  const bridgeDistDir = resolveBridgeDistArchDir(repoRoot, arch)
  return {
    distBinaryPath: path.join(bridgeDistDir, APPLE_BRIDGE_BINARY_NAME),
    distVersionPath: path.join(bridgeDistDir, "version.json"),
    packagedBridgeDir: path.join(resolveStagedExtensionsSource(repoRoot), "apple-calendar-mcp", "bridge"),
    packagedBinaryPath: path.join(resolveStagedExtensionsSource(repoRoot), "apple-calendar-mcp", "bridge", APPLE_BRIDGE_BINARY_NAME),
    packagedVersionPath: path.join(resolveStagedExtensionsSource(repoRoot), "apple-calendar-mcp", "bridge", "version.json"),
  }
}

export function verifyAppleBridgeVersion(options: {
  repoRoot: string
  arch: AppleBridgeArch
  appVersion: string
}) {
  const paths = resolvePackagedBridgePaths(options.repoRoot, options.arch)
  return verifyAppleBridgeVersionMetadata(paths.distVersionPath, options.appVersion)
}

export function stageMacPackagedExtensions(options: {
  repoRoot: string
  arch: AppleBridgeArch
  appVersion: string
}): void {
  const paths = resolvePackagedBridgePaths(options.repoRoot, options.arch)
  verifyAppleBridgeVersion(options)

  if (!existsSync(paths.distBinaryPath)) {
    throw new Error(`Missing Apple Calendar bridge binary for ${options.arch}: ${paths.distBinaryPath}`)
  }

  mkdirSync(paths.packagedBridgeDir, { recursive: true })
  cpSync(paths.distBinaryPath, paths.packagedBinaryPath)
  cpSync(paths.distVersionPath, paths.packagedVersionPath)
}

function normalizeAppleApiKeyEnv(env: NodeJS.ProcessEnv, stageRoot: string): NodeJS.ProcessEnv {
  const nextEnv = { ...env }
  const rawKey = env.APPLE_API_KEY
  if (!rawKey) {
    return nextEnv
  }

  if (existsSync(rawKey)) {
    return nextEnv
  }

  const apiKeyPath = path.join(stageRoot, `AuthKey_${env.APPLE_API_KEY_ID ?? "Orbyt"}.p8`)
  writeFileSync(apiKeyPath, rawKey, "utf8")
  nextEnv.APPLE_API_KEY = apiKeyPath
  return nextEnv
}

function resolveRuntimeDependencyPackages(repoRoot: string) {
  return [
    {
      sourceDir: path.join(repoRoot, "packages", "contracts"),
      stageDirName: "contracts",
      packageJson: contractsPackageJson,
    },
    {
      sourceDir: path.join(repoRoot, "packages", "server"),
      stageDirName: "server",
      packageJson: serverPackageJson,
    },
    {
      sourceDir: path.join(repoRoot, "packages", "shared"),
      stageDirName: "shared",
      packageJson: sharedPackageJson,
    },
    {
      sourceDir: path.join(repoRoot, "packages", "shared-runtime"),
      stageDirName: "shared-runtime",
      packageJson: sharedRuntimePackageJson,
    },
  ]
}

function stageRuntimeWorkspacePackage(stageVendorDir: string, pkg: {
  sourceDir: string
  stageDirName: string
  packageJson: Record<string, unknown>
}) {
  const stageDir = path.join(stageVendorDir, pkg.stageDirName)
  mkdirSync(stageDir, { recursive: true })
  cpSync(path.join(pkg.sourceDir, "dist"), path.join(stageDir, "dist"), { recursive: true })
  const packageJson = JSON.parse(JSON.stringify(pkg.packageJson)) as Record<string, unknown>
  if (packageJson.dependencies && typeof packageJson.dependencies === "object") {
    for (const [dependency, value] of Object.entries(packageJson.dependencies as Record<string, string>)) {
      if (value === "workspace:*") {
        packageJson.dependencies[dependency] = dependency === "@orbyt/contracts"
          ? "file:../contracts"
          : "file:../shared-runtime"
      }
    }
  }
  writeFileSync(path.join(stageDir, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`, "utf8")
}

export function createStagePackageJson(stageAppDir: string, signed: boolean) {
  const repoRoot = resolveRepoRoot()
  return {
    name: "orbyt-desktop-build",
    version: rootPackageJson.version,
    packageManager: String(rootPackageJson.packageManager ?? "bun@1.3.5"),
    private: true,
    description: "Orbyt desktop build",
    author: "Orbyt",
    type: "module",
    main: "dist/main/main.js",
    build: createMacPackagingConfig({
      productName: ORBYT_PRODUCT_NAME,
      appId: ORBYT_APP_ID,
      stageAppDir,
      outputDir: path.join(stageAppDir, "release"),
      signed,
      afterSignPath: path.join(resolveBuildResourcesSource(repoRoot), "notarize.mjs"),
    }),
    dependencies: {
      "@modelcontextprotocol/sdk": electronPackageJson.dependencies["@modelcontextprotocol/sdk"],
      "@openai/codex": electronPackageJson.dependencies["@openai/codex"],
      "@orbyt/contracts": "file:vendor/contracts",
      "@orbyt/server": "file:vendor/server",
      "@orbyt/shared": "file:vendor/shared",
      "@orbyt/shared-runtime": "file:vendor/shared-runtime",
      "web-push": electronPackageJson.dependencies["web-push"],
      "ws": electronPackageJson.dependencies.ws,
    },
  }
}

function installStageAppDependencies(stageAppDir: string, verbose: boolean, logger?: BuildLogger): void {
  runCommand("bun", [
    "install",
    "--production",
    "--no-save",
    "--force",
    "--backend=copyfile",
    "--linker",
    "hoisted",
    "--no-progress",
  ], {
    cwd: stageAppDir,
    verbose,
    logger,
  })
}

function stageDesktopApp(options: {
  repoRoot: string
  stageAppDir: string
  signed: boolean
  arch: AppleBridgeArch
  appVersion: string
  verbose: boolean
  logger: BuildLogger
}) {
  const electronDistSource = resolveElectronDistSource(options.repoRoot)
  const electronResourcesSource = resolveElectronResourcesSource(options.repoRoot)
  const buildResourcesSource = resolveBuildResourcesSource(options.repoRoot)
  const stagedExtensionsSource = resolveStagedExtensionsSource(options.repoRoot)
  const stagedSkillsSource = resolveStagedSkillsSource(options.repoRoot)

  if (!existsSync(electronDistSource)) {
    throw new Error(`Missing Electron dist output at ${electronDistSource}. Run bun run build first.`)
  }
  if (!existsSync(stagedExtensionsSource)) {
    throw new Error(`Missing staged bundled extensions at ${stagedExtensionsSource}. Run bun run stage:bundled-extensions first.`)
  }
  if (!existsSync(stagedSkillsSource)) {
    throw new Error(`Missing staged bundled skills at ${stagedSkillsSource}. Run bun run stage:bundled-skills first.`)
  }

  const stageBuildResourcesDir = path.join(options.stageAppDir, "build-resources")
  const stageExtraResourcesDir = path.join(options.stageAppDir, "extra-resources")
  const stageVendorDir = path.join(options.stageAppDir, "vendor")

  mkdirSync(options.stageAppDir, { recursive: true })
  mkdirSync(stageBuildResourcesDir, { recursive: true })
  mkdirSync(stageExtraResourcesDir, { recursive: true })
  mkdirSync(stageVendorDir, { recursive: true })

  options.logger.phase("Staging Electron app bundle")
  cpSync(electronDistSource, path.join(options.stageAppDir, "dist"), { recursive: true })
  cpSync(path.join(electronResourcesSource, "icon.png"), path.join(stageBuildResourcesDir, "icon.png"))
  cpSync(buildResourcesSource, stageBuildResourcesDir, { recursive: true })
  cpSync(stagedExtensionsSource, path.join(stageExtraResourcesDir, "extensions"), { recursive: true })
  cpSync(stagedSkillsSource, path.join(stageExtraResourcesDir, "skills"), { recursive: true })
  createMacIcon(stageBuildResourcesDir, path.join(stageBuildResourcesDir, "icon.png"), options.verbose, options.logger)

  options.logger.phase("Staging Apple Calendar bridge assets")
  stageMacPackagedExtensions({
    repoRoot: options.repoRoot,
    arch: options.arch,
    appVersion: options.appVersion,
  })
  cpSync(stagedExtensionsSource, path.join(stageExtraResourcesDir, "extensions"), {
    recursive: true,
    force: true,
  })

  for (const pkg of resolveRuntimeDependencyPackages(options.repoRoot)) {
    stageRuntimeWorkspacePackage(stageVendorDir, pkg)
  }

  options.logger.phase("Writing staged package manifest")
  writeFileSync(
    path.join(options.stageAppDir, "package.json"),
    `${JSON.stringify(createStagePackageJson(options.stageAppDir, options.signed), null, 2)}\n`,
    "utf8",
  )

  options.logger.phase("Installing staged desktop dependencies")
  installStageAppDependencies(options.stageAppDir, options.verbose, options.logger)
}

function buildDesktopArtifact(options: {
  repoRoot: string
  arch: AppleBridgeArch
  appVersion: string
  signed: boolean
  outputDir?: string
  skipBuild?: boolean
  verbose?: boolean
  logger?: BuildLogger
}) {
  const verbose = options.verbose ?? false
  const logger = options.logger ?? createBuildLogger({
    repoRoot: options.repoRoot,
    arch: options.arch,
    signed: options.signed,
    verbose,
  })
  logger.info(`Build log: ${logger.logPath}`)

  if (options.signed) {
    logger.phase("Checking full Xcode availability")
    ensureFullXcode(verbose, logger)
  }

  if (!options.skipBuild) {
    logger.phase("Building workspace packages")
    runCommand("bun", ["run", "build"], {
      cwd: options.repoRoot,
      verbose,
      logger,
    })
    logger.phase(`Building Apple Calendar bridge (${options.arch})`)
    runCommand("bun", ["scripts/build-apple-calendar-bridge.ts", "--arch", options.arch, "--app-version", options.appVersion], {
      cwd: options.repoRoot,
      verbose,
      logger,
    })
    logger.phase("Staging bundled extensions")
    runCommand("bun", ["run", "stage:bundled-extensions"], {
      cwd: options.repoRoot,
      verbose,
      logger,
    })
    logger.phase("Staging bundled skills")
    runCommand("bun", ["run", "stage:bundled-skills"], {
      cwd: options.repoRoot,
      verbose,
      logger,
    })
  } else {
    logger.phase("Skipping workspace rebuild and reusing existing build outputs")
  }

  const stageAppDir = mkdtempSync(path.join(tmpdir(), "orbyt-mac-build-"))
  logger.info(`Temporary stage directory: ${stageAppDir}`)
  stageDesktopApp({
    repoRoot: options.repoRoot,
    stageAppDir,
    signed: options.signed,
    arch: options.arch,
    appVersion: options.appVersion,
    verbose,
    logger,
  })

  const releaseDir = options.outputDir ?? path.join(options.repoRoot, "release")
  mkdirSync(releaseDir, { recursive: true })

  const builderEnv = normalizeAppleApiKeyEnv(process.env, stageAppDir)
  logger.phase("Running electron-builder packaging")
  runCommand("bun", [
    "x",
    "--install=fallback",
    "electron-builder",
    "--projectDir",
    stageAppDir,
    "--mac",
    "dmg",
    `--${options.arch === "x64" ? "x64" : "arm64"}`,
    "--publish",
    "never",
    "--config.directories.output=" + releaseDir,
  ], {
    cwd: options.repoRoot,
    verbose,
    logger,
    env: {
      ...builderEnv,
      CSC_IDENTITY_AUTO_DISCOVERY: options.signed ? builderEnv.CSC_IDENTITY_AUTO_DISCOVERY : "false",
    },
  })

  if (options.signed) {
    const appDir = resolvePackagedAppPath({
      releaseDir,
      productName: ORBYT_PRODUCT_NAME,
      arch: options.arch,
    })
    const helperPath = resolvePackagedAppleCalendarBridgePathsFromApp(appDir).executablePath
    logger.phase("Verifying signed macOS artifact")
    runCommand("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appDir], { cwd: options.repoRoot, verbose, logger })
    runCommand("codesign", ["--verify", "--deep", "--strict", "--verbose=2", helperPath], { cwd: options.repoRoot, verbose, logger })
    runCommand("spctl", ["--assess", "--type", "execute", appDir], { cwd: options.repoRoot, verbose, logger })
    runCommand("xcrun", ["stapler", "validate", appDir], { cwd: options.repoRoot, verbose, logger })
  }

  logger.phase("Build complete")
  return {
    stageAppDir,
    releaseDir,
    logPath: logger.logPath,
  }
}

if (import.meta.main) {
  const repoRoot = resolveRepoRoot()
  const archArg = process.argv.includes("--arch")
    ? process.argv[process.argv.indexOf("--arch") + 1]
    : undefined
  const arch = (archArg === "x64" ? "x64" : "arm64") as AppleBridgeArch
  const signedArg = process.argv.includes("--signed")
  const signingMode = detectMacSigningMode(process.env)
  const signed = signedArg ? signingMode.signed : false
  const appVersionArg = process.argv.includes("--app-version")
    ? process.argv[process.argv.indexOf("--app-version") + 1]
    : rootPackageJson.version
  const outputArg = process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : undefined
  const skipBuild = process.argv.includes("--skip-build")
  const verbose = process.argv.includes("--verbose")

  if (signedArg && !signingMode.signed) {
    throw new Error(`Signed macOS packaging requested, but required secrets are missing: ${signingMode.missing.join(", ")}`)
  }

  const result = buildDesktopArtifact({
    repoRoot,
    arch,
    appVersion: appVersionArg,
    signed,
    outputDir: outputArg,
    skipBuild,
    verbose,
  })

  process.stdout.write(`Built Orbyt macOS artifact in ${result.releaseDir}\n`)
  process.stdout.write(`Build log saved to ${result.logPath}\n`)
}
