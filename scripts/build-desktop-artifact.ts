import { cpSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import rootPackageJson from "../package.json" with { type: "json" }
import electronPackageJson from "../packages/electron/package.json" with { type: "json" }
import contractsPackageJson from "../packages/contracts/package.json" with { type: "json" }
import serverPackageJson from "../packages/server/package.json" with { type: "json" }
import sharedPackageJson from "../packages/shared/package.json" with { type: "json" }
import sharedRuntimePackageJson from "../packages/shared-runtime/package.json" with { type: "json" }
import { resolveGitHubPublishConfig } from "./build-macos-desktop-artifact"

const ORBYT_APP_ID = "com.orbyt.app"
const ORBYT_PRODUCT_NAME = "Orbyt"

export type DesktopBuildPlatform = "linux" | "win"
export type DesktopBuildArch = "x64"

function resolveRepoRoot(): string {
  return path.resolve(import.meta.dir, "..")
}

function resolveElectronDistSource(repoRoot: string): string {
  return path.join(repoRoot, "packages", "electron", "dist")
}

function resolveElectronResourcesSource(repoRoot: string): string {
  return path.join(repoRoot, "packages", "electron", "resources")
}

function resolveBuildResourcesSource(repoRoot: string): string {
  return path.join(repoRoot, "packages", "electron", "build-resources")
}

function resolveStagedExtensionsSource(repoRoot: string): string {
  return path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions")
}

function resolveStagedSkillsSource(repoRoot: string): string {
  return path.join(repoRoot, "packages", "electron", "dist", "resources", "skills")
}

function resolveRuntimeHostPlatform(platform: DesktopBuildPlatform): NodeJS.Platform {
  return platform === "win" ? "win32" : "linux"
}

function resolveDefaultTarget(platform: DesktopBuildPlatform): string {
  return platform === "win" ? "nsis" : "AppImage"
}

function resolvePlatformFlag(platform: DesktopBuildPlatform): "--linux" | "--win" {
  return platform === "win" ? "--win" : "--linux"
}

function runCommand(command: string, args: string[], options: {
  cwd: string
  verbose?: boolean
  env?: NodeJS.ProcessEnv
}): void {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: options.verbose ? "inherit" : "pipe",
    shell: process.platform === "win32",
  })

  if (result.status !== 0) {
    throw new Error(
      result.stderr?.toString("utf8").trim()
        || result.stdout?.toString("utf8").trim()
        || `${command} ${args.join(" ")} failed`,
    )
  }
}

export function createDesktopPackagingConfig(options: {
  platform: DesktopBuildPlatform
  target: string
  stageAppDir: string
  outputDir: string
  signed: boolean
  updateRepository?: string
}) {
  const publishConfig = resolveGitHubPublishConfig(options.updateRepository)
  const config: Record<string, unknown> = {
    appId: ORBYT_APP_ID,
    productName: ORBYT_PRODUCT_NAME,
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
    ...(publishConfig ? { publish: [publishConfig] } : {}),
  }

  if (options.platform === "linux") {
    config.linux = {
      target: [options.target],
      executableName: "orbyt",
      icon: "icon.png",
      category: "Education",
    }
  } else {
    config.npmRebuild = false
    config.win = {
      target: [options.target],
      icon: "icon.png",
      signAndEditExecutable: options.signed,
    }
  }

  return config
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
}): void {
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

export function createDesktopStagePackageJson(options: {
  platform: DesktopBuildPlatform
  target: string
  stageAppDir: string
  signed: boolean
  appVersion?: string
}) {
  return {
    name: "orbyt-desktop-build",
    version: options.appVersion ?? rootPackageJson.version,
    packageManager: String(rootPackageJson.packageManager ?? "bun@1.3.5"),
    private: true,
    description: "Orbyt desktop build",
    author: "Orbyt",
    type: "module",
    main: "dist/main/main.js",
    build: createDesktopPackagingConfig({
      platform: options.platform,
      target: options.target,
      stageAppDir: options.stageAppDir,
      outputDir: path.join(options.stageAppDir, "release"),
      signed: options.signed,
    }),
    dependencies: {
      "@modelcontextprotocol/sdk": electronPackageJson.dependencies["@modelcontextprotocol/sdk"],
      "@openai/codex": electronPackageJson.dependencies["@openai/codex"],
      "@orbyt/contracts": "file:vendor/contracts",
      "@orbyt/server": "file:vendor/server",
      "@orbyt/shared": "file:vendor/shared",
      "@orbyt/shared-runtime": "file:vendor/shared-runtime",
      "electron-updater": electronPackageJson.dependencies["electron-updater"],
      "ws": electronPackageJson.dependencies.ws,
    },
  }
}

export function createDesktopElectronBuilderArgs(options: {
  stageAppDir: string
  platform: DesktopBuildPlatform
  arch: DesktopBuildArch
  releaseDir: string
}) {
  return [
    "x",
    "--install=fallback",
    "electron-builder",
    "--projectDir",
    options.stageAppDir,
    resolvePlatformFlag(options.platform),
    `--${options.arch}`,
    "--publish",
    "never",
    "--config.directories.output=" + options.releaseDir,
  ]
}

function installStageAppDependencies(stageAppDir: string, verbose: boolean): void {
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
  })
}

function stageDesktopApp(options: {
  repoRoot: string
  stageAppDir: string
  platform: DesktopBuildPlatform
  target: string
  signed: boolean
  appVersion?: string
  verbose: boolean
}): void {
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

  cpSync(electronDistSource, path.join(options.stageAppDir, "dist"), { recursive: true })
  cpSync(path.join(electronResourcesSource, "icon.png"), path.join(stageBuildResourcesDir, "icon.png"))
  if (existsSync(buildResourcesSource)) {
    cpSync(buildResourcesSource, stageBuildResourcesDir, { recursive: true })
  }
  cpSync(stagedExtensionsSource, path.join(stageExtraResourcesDir, "extensions"), { recursive: true })
  cpSync(stagedSkillsSource, path.join(stageExtraResourcesDir, "skills"), { recursive: true })

  for (const pkg of resolveRuntimeDependencyPackages(options.repoRoot)) {
    stageRuntimeWorkspacePackage(stageVendorDir, pkg)
  }

  writeFileSync(
    path.join(options.stageAppDir, "package.json"),
    `${JSON.stringify(createDesktopStagePackageJson({
      platform: options.platform,
      target: options.target,
      stageAppDir: options.stageAppDir,
      signed: options.signed,
      appVersion: options.appVersion,
    }), null, 2)}\n`,
    "utf8",
  )

  installStageAppDependencies(options.stageAppDir, options.verbose)
}

function buildDesktopArtifact(options: {
  repoRoot: string
  platform: DesktopBuildPlatform
  target: string
  arch: DesktopBuildArch
  signed: boolean
  appVersion?: string
  outputDir?: string
  skipBuild?: boolean
  verbose?: boolean
}): void {
  const verbose = options.verbose ?? false
  if (!options.skipBuild) {
    runCommand("bun", ["run", "build"], {
      cwd: options.repoRoot,
      verbose,
    })
    runCommand("bun", ["run", "stage:bundled-extensions", "--", "--platform", resolveRuntimeHostPlatform(options.platform)], {
      cwd: options.repoRoot,
      verbose,
    })
    runCommand("bun", ["run", "stage:bundled-skills"], {
      cwd: options.repoRoot,
      verbose,
    })
  }

  const stageAppDir = mkdtempSync(path.join(tmpdir(), `orbyt-${options.platform}-build-`))
  stageDesktopApp({
    repoRoot: options.repoRoot,
    stageAppDir,
    platform: options.platform,
    target: options.target,
    signed: options.signed,
    appVersion: options.appVersion,
    verbose,
  })

  const releaseDir = path.resolve(options.repoRoot, options.outputDir ?? "release")
  mkdirSync(releaseDir, { recursive: true })
  const buildEnv = { ...process.env }
  if (!options.signed) {
    buildEnv.CSC_IDENTITY_AUTO_DISCOVERY = "false"
    delete buildEnv.CSC_LINK
    delete buildEnv.CSC_KEY_PASSWORD
    delete buildEnv.APPLE_API_KEY
    delete buildEnv.APPLE_API_KEY_ID
    delete buildEnv.APPLE_API_ISSUER
  }

  runCommand("bun", createDesktopElectronBuilderArgs({
    stageAppDir,
    platform: options.platform,
    arch: options.arch,
    releaseDir,
  }), {
    cwd: options.repoRoot,
    verbose,
    env: buildEnv,
  })
}

if (import.meta.main) {
  const repoRoot = resolveRepoRoot()
  const platformArg = process.argv.includes("--platform")
    ? process.argv[process.argv.indexOf("--platform") + 1]
    : undefined
  const platform = platformArg === "win" ? "win" : "linux"
  const target = process.argv.includes("--target")
    ? process.argv[process.argv.indexOf("--target") + 1] ?? resolveDefaultTarget(platform)
    : resolveDefaultTarget(platform)
  const outputDir = process.argv.includes("--output-dir")
    ? process.argv[process.argv.indexOf("--output-dir") + 1]
    : undefined
  const appVersion = process.argv.includes("--app-version")
    ? process.argv[process.argv.indexOf("--app-version") + 1]
    : undefined

  buildDesktopArtifact({
    repoRoot,
    platform,
    target,
    arch: "x64",
    signed: process.argv.includes("--signed"),
    appVersion,
    outputDir,
    skipBuild: process.argv.includes("--skip-build"),
    verbose: process.argv.includes("--verbose"),
  })
}
