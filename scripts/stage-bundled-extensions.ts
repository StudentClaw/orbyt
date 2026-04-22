import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

export type StageBundledExtensionsOptions = {
  extensionsRoot: string
  outputRoot: string
  installDependencies?: boolean
}

const APPLE_CALENDAR_PLUGIN_ID = "apple-calendar-mcp"
const APPLE_BRIDGE_BINARY_NAME = "CalendarAPIBridge"
const BUNDLED_RUNTIME_PACKAGE_NAME = "student-claw-bundled-extension-runtime"

type PackageJson = {
  name?: string
  version?: string
  private?: boolean
  type?: string
  dependencies?: Record<string, string>
  packageManager?: string
}

function discoverBundledExtensionDirs(extensionsRoot: string): string[] {
  if (!existsSync(extensionsRoot)) {
    return []
  }

  return readdirSync(extensionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(extensionsRoot, entry.name))
    .filter((extensionDir) => existsSync(path.join(extensionDir, "manifest.json")))
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right)))
}

function resolveRepoRoot(extensionsRoot: string): string {
  return path.resolve(extensionsRoot, "..", "..")
}

function readPackageJson(filePath: string): PackageJson {
  return JSON.parse(readFileSync(filePath, "utf8")) as PackageJson
}

function resolveBuiltAppleBridgePath(extensionDir: string): string | null {
  const bridgeRoot = path.join(extensionDir, "bridge")
  const directReleasePath = path.join(bridgeRoot, ".build", "release", APPLE_BRIDGE_BINARY_NAME)
  if (existsSync(directReleasePath)) {
    return directReleasePath
  }

  const buildRoot = path.join(bridgeRoot, ".build")
  if (!existsSync(buildRoot)) {
    return null
  }

  for (const entry of readdirSync(buildRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    const candidate = path.join(buildRoot, entry.name, "release", APPLE_BRIDGE_BINARY_NAME)
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

function copyRuntimeSubset(extensionDir: string, stagedExtensionDir: string): void {
  mkdirSync(stagedExtensionDir, { recursive: true })
  cpSync(path.join(extensionDir, "manifest.json"), path.join(stagedExtensionDir, "manifest.json"))

  const distDir = path.join(extensionDir, "dist")
  if (existsSync(distDir)) {
    cpSync(distDir, path.join(stagedExtensionDir, "dist"), {
      recursive: true,
      filter: (source) => !/\.test\.[^.]+$/.test(path.basename(source)),
    })
  }
}

function stageBundledWorkspaceRuntimePackage(
  repoRoot: string,
  outputRoot: string,
  packageName: string,
  stagedPackages = new Set<string>(),
): void {
  if (stagedPackages.has(packageName)) {
    return
  }

  if (!packageName.startsWith("@student-claw/")) {
    throw new Error(`Unsupported bundled workspace dependency: ${packageName}`)
  }

  const stageDirName = packageName.replace("@student-claw/", "")
  const sourceDir = path.join(repoRoot, "packages", stageDirName)
  const sourcePackageJsonPath = path.join(sourceDir, "package.json")
  const sourceDistDir = path.join(sourceDir, "dist")

  if (!existsSync(sourcePackageJsonPath) || !existsSync(sourceDistDir)) {
    throw new Error(`Missing staged runtime package for ${packageName} at ${sourceDir}`)
  }

  const stagedPackageDir = path.join(outputRoot, "vendor", stageDirName)
  mkdirSync(stagedPackageDir, { recursive: true })
  cpSync(sourceDistDir, path.join(stagedPackageDir, "dist"), { recursive: true })

  const packageJson = readPackageJson(sourcePackageJsonPath)
  const dependencies = { ...(packageJson.dependencies ?? {}) }
  for (const [dependency, version] of Object.entries(dependencies)) {
    if (version === "workspace:*") {
      stageBundledWorkspaceRuntimePackage(repoRoot, outputRoot, dependency, stagedPackages)
      dependencies[dependency] = `file:../${dependency.replace("@student-claw/", "")}`
    }
  }

  writeFileSync(
    path.join(stagedPackageDir, "package.json"),
    `${JSON.stringify({ ...packageJson, dependencies }, null, 2)}\n`,
    "utf8",
  )

  stagedPackages.add(packageName)
}

function collectBundledRuntimeDependencies(extensionDirs: string[]): Record<string, string> {
  const dependencies: Record<string, string> = {}

  for (const extensionDir of extensionDirs) {
    const packageJsonPath = path.join(extensionDir, "package.json")
    if (!existsSync(packageJsonPath)) {
      continue
    }

    const packageJson = readPackageJson(packageJsonPath)
    for (const [dependency, version] of Object.entries(packageJson.dependencies ?? {})) {
      dependencies[dependency] = version
    }
  }

  return dependencies
}

export function createBundledExtensionRuntimePackageJson(options: {
  repoRoot: string
  extensionDirs: string[]
}): PackageJson {
  const rootPackageJsonPath = path.join(options.repoRoot, "package.json")
  const rootPackageJson = existsSync(rootPackageJsonPath) ? readPackageJson(rootPackageJsonPath) : {}
  const dependencies = collectBundledRuntimeDependencies(options.extensionDirs)

  for (const [dependency, version] of Object.entries(dependencies)) {
    if (version === "workspace:*") {
      dependencies[dependency] = `file:vendor/${dependency.replace("@student-claw/", "")}`
    }
  }

  return {
    name: BUNDLED_RUNTIME_PACKAGE_NAME,
    version: "0.1.0",
    private: true,
    type: "module",
    packageManager: rootPackageJson.packageManager,
    dependencies,
  }
}

function installBundledRuntimeDependencies(outputRoot: string): void {
  const result = spawnSync("bun", [
    "install",
    "--production",
    "--no-save",
    "--force",
    "--backend=copyfile",
    "--linker",
    "hoisted",
    "--no-progress",
  ], {
    cwd: outputRoot,
    stdio: "pipe",
  })

  if (result.status !== 0) {
    const stderr = result.stderr?.toString("utf8").trim()
    const stdout = result.stdout?.toString("utf8").trim()
    throw new Error(stderr || stdout || "bun install failed while staging bundled extension dependencies")
  }
}

function stagePerExtensionDependencyTrees(outputRoot: string, pluginIds: readonly string[]): void {
  const sharedNodeModulesDir = path.join(outputRoot, "node_modules")
  if (!existsSync(sharedNodeModulesDir)) {
    return
  }

  for (const pluginId of pluginIds) {
    const stagedExtensionDir = path.join(outputRoot, pluginId)
    if (!existsSync(stagedExtensionDir)) {
      continue
    }

    cpSync(sharedNodeModulesDir, path.join(stagedExtensionDir, "node_modules"), {
      recursive: true,
      force: true,
    })
  }
}

function stageBundledRuntimeDependencies(
  repoRoot: string,
  extensionDirs: string[],
  outputRoot: string,
  installDependencies: boolean,
): void {
  const runtimePackageJson = createBundledExtensionRuntimePackageJson({
    repoRoot,
    extensionDirs,
  })

  const stagedPackages = new Set<string>()
  for (const [dependency, version] of Object.entries(runtimePackageJson.dependencies ?? {})) {
    if (version.startsWith("file:vendor/")) {
      stageBundledWorkspaceRuntimePackage(repoRoot, outputRoot, dependency, stagedPackages)
    }
  }

  writeFileSync(path.join(outputRoot, "package.json"), `${JSON.stringify(runtimePackageJson, null, 2)}\n`, "utf8")
  if (installDependencies) {
    installBundledRuntimeDependencies(outputRoot)
  }
}

function stageAppleBridge(extensionDir: string, stagedExtensionDir: string): void {
  const bridgeBinaryPath = resolveBuiltAppleBridgePath(extensionDir)
  if (!bridgeBinaryPath) {
    return
  }

  const stagedBridgeDir = path.join(stagedExtensionDir, "bridge")
  mkdirSync(stagedBridgeDir, { recursive: true })
  cpSync(bridgeBinaryPath, path.join(stagedBridgeDir, APPLE_BRIDGE_BINARY_NAME))
}

export function stageBundledExtensions(options: StageBundledExtensionsOptions): string[] {
  const repoRoot = resolveRepoRoot(options.extensionsRoot)
  rmSync(options.outputRoot, { recursive: true, force: true })
  mkdirSync(options.outputRoot, { recursive: true })

  const stagedPluginIds: string[] = []
  const extensionDirs = discoverBundledExtensionDirs(options.extensionsRoot)

  for (const extensionDir of extensionDirs) {
    const pluginId = path.basename(extensionDir)
    const stagedExtensionDir = path.join(options.outputRoot, pluginId)

    copyRuntimeSubset(extensionDir, stagedExtensionDir)
    if (pluginId === APPLE_CALENDAR_PLUGIN_ID) {
      stageAppleBridge(extensionDir, stagedExtensionDir)
    }

    stagedPluginIds.push(pluginId)
  }

  stageBundledRuntimeDependencies(repoRoot, extensionDirs, options.outputRoot, options.installDependencies !== false)
  stagePerExtensionDependencyTrees(options.outputRoot, stagedPluginIds)

  return stagedPluginIds
}

export function getDefaultStageOptions(): StageBundledExtensionsOptions {
  const repoRoot = path.resolve(import.meta.dir, "..")
  return {
    extensionsRoot: path.join(repoRoot, "packages", "extensions"),
    outputRoot: path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions"),
  }
}

if (import.meta.main) {
  const options = getDefaultStageOptions()
  const stagedPluginIds = stageBundledExtensions(options)
  process.stdout.write(`Staged bundled extensions: ${stagedPluginIds.join(", ")}\n`)
}
