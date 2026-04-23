import { existsSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { resolvePackagedAppleCalendarBridgePathsFromApp } from "../packages/electron/src/plugins/apple-calendar-bridge-paths.js"

export function resolveMacArtifactPaths(options: {
  releaseDir: string
  productName: string
}) {
  const appPath = path.join(options.releaseDir, `${options.productName}.app`)
  return {
    appPath,
    helperPath: resolvePackagedAppleCalendarBridgePathsFromApp(appPath).executablePath,
  }
}

export function verifyMacArtifactLayout(options: {
  appPath: string
  helperPath: string
  exists?: (path: string) => boolean
}) {
  const exists = options.exists ?? existsSync

  if (!exists(options.appPath)) {
    throw new Error(`Missing packaged Orbyt app at ${options.appPath}`)
  }

  if (!exists(options.helperPath)) {
    throw new Error(`Missing Apple Calendar packaged bridge at ${options.helperPath}`)
  }

  if (options.helperPath.includes("app.asar")) {
    throw new Error("Apple Calendar bridge must live outside app.asar")
  }

  return {
    appPath: options.appPath,
    helperPath: options.helperPath,
  }
}

export function createMacArtifactVerificationCommands(options: {
  appPath: string
  helperPath: string
}) {
  return [
    ["codesign", ["--verify", "--deep", "--strict", "--verbose=2", options.appPath]],
    ["codesign", ["--verify", "--deep", "--strict", "--verbose=2", options.helperPath]],
    ["spctl", ["--assess", "--type", "execute", options.appPath]],
    ["xcrun", ["stapler", "validate", options.appPath]],
  ] as const
}

function runVerificationCommand(command: string, args: readonly string[], verbose: boolean) {
  const result = spawnSync(command, [...args], {
    stdio: verbose ? "inherit" : "pipe",
    env: process.env,
  })

  if (result.status !== 0) {
    throw new Error(
      result.stderr?.toString("utf8").trim()
        || result.stdout?.toString("utf8").trim()
        || `${command} ${args.join(" ")} failed`,
    )
  }
}

export function verifyMacDesktopArtifact(options: {
  appPath: string
  helperPath: string
  verbose?: boolean
}) {
  const layout = verifyMacArtifactLayout(options)
  const commands = createMacArtifactVerificationCommands(layout)

  for (const [command, args] of commands) {
    runVerificationCommand(command, args, options.verbose ?? false)
  }

  return {
    ...layout,
    commands,
  }
}

if (import.meta.main) {
  const releaseDir = process.argv.includes("--release-dir")
    ? process.argv[process.argv.indexOf("--release-dir") + 1]
    : path.join(path.resolve(import.meta.dir, ".."), "release")
  const productName = process.argv.includes("--product-name")
    ? process.argv[process.argv.indexOf("--product-name") + 1]
    : "Orbyt"
  const appPathArg = process.argv.includes("--app-path")
    ? process.argv[process.argv.indexOf("--app-path") + 1]
    : undefined
  const verbose = process.argv.includes("--verbose")
  const paths = appPathArg
    ? {
      appPath: appPathArg,
      helperPath: resolvePackagedAppleCalendarBridgePathsFromApp(appPathArg).executablePath,
    }
    : resolveMacArtifactPaths({ releaseDir, productName })

  const result = verifyMacDesktopArtifact({
    ...paths,
    verbose,
  })

  process.stdout.write([
    "Verified signed macOS artifact.",
    `App: ${result.appPath}`,
    `Helper: ${result.helperPath}`,
    "Helper placement: outside app.asar",
  ].join("\n") + "\n")
}
