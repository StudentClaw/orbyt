import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { detectMacSigningMode } from "./build-macos-desktop-artifact"

export type AppleSigningAssetName =
  | "CSC_LINK"
  | "CSC_KEY_PASSWORD"
  | "APPLE_API_KEY"
  | "APPLE_API_KEY_ID"
  | "APPLE_API_ISSUER"

type AppleSigningAssetStatus = {
  name: AppleSigningAssetName
  ok: boolean
  source: "env" | "path" | "inline" | "url" | "missing"
  detail: string
  reason?: "missing" | "unreadable_path"
}

type XcodeProbeResult =
  | {
    ok: true
    developerDir: string
    version: string
  }
  | {
    ok: false
    developerDir: string | null
    error: string
  }

export function assessAppleSigningAsset(
  name: AppleSigningAssetName,
  value: string | undefined,
  options?: {
    exists?: (path: string) => boolean
  },
): AppleSigningAssetStatus {
  const exists = options?.exists ?? existsSync
  const normalized = value?.trim()

  if (!normalized) {
    return {
      name,
      ok: false,
      source: "missing",
      detail: `${name} is not set.`,
      reason: "missing",
    }
  }

  if (name === "CSC_KEY_PASSWORD" || name === "APPLE_API_KEY_ID" || name === "APPLE_API_ISSUER") {
    return {
      name,
      ok: true,
      source: "env",
      detail: `${name} is set.`,
    }
  }

  if (name === "APPLE_API_KEY" && normalized.includes("BEGIN PRIVATE KEY")) {
    return {
      name,
      ok: true,
      source: "inline",
      detail: `${name} is set as inline key content.`,
    }
  }

  if (/^https?:\/\//.test(normalized)) {
    return {
      name,
      ok: true,
      source: "url",
      detail: `${name} is set as a URL.`,
    }
  }

  if (exists(normalized)) {
    return {
      name,
      ok: true,
      source: "path",
      detail: `${name} points to ${normalized}.`,
    }
  }

  return {
    name,
    ok: false,
    source: "path",
    detail: `${name} points to ${normalized}, but that file is not readable.`,
    reason: "unreadable_path",
  }
}

export function probeFullXcode(): XcodeProbeResult {
  const developerDir = spawnSync("xcode-select", ["-p"], {
    stdio: "pipe",
    env: process.env,
  })

  const developerDirText = developerDir.status === 0
    ? developerDir.stdout.toString("utf8").trim()
    : null

  const result = spawnSync("xcodebuild", ["-version"], {
    stdio: "pipe",
    env: process.env,
  })

  if (result.status !== 0) {
    return {
      ok: false,
      developerDir: developerDirText,
      error: result.stderr.toString("utf8").trim() || "xcodebuild -version failed",
    }
  }

  return {
    ok: true,
    developerDir: developerDirText ?? "",
    version: result.stdout.toString("utf8").trim(),
  }
}

export function assessMacSigningReadiness(options?: {
  env?: Record<string, string | undefined>
  exists?: (path: string) => boolean
  probeXcode?: () => XcodeProbeResult
}) {
  const env = options?.env ?? process.env
  const probeXcode = options?.probeXcode ?? probeFullXcode
  const signingMode = detectMacSigningMode(env)
  const xcode = probeXcode()
  const assets = (["CSC_LINK", "CSC_KEY_PASSWORD", "APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"] as const)
    .map((name) => assessAppleSigningAsset(name, env[name], { exists: options?.exists }))

  const failures: string[] = []

  if (!xcode.ok) {
    failures.push("Full Xcode is required for signed macOS packaging.")
  }

  if (!signingMode.signed) {
    failures.push(`Missing required signing variables: ${signingMode.missing.join(", ")}`)
  }

  for (const asset of assets) {
    if (!asset.ok && asset.reason === "unreadable_path") {
      failures.push(asset.detail)
    }
  }

  return {
    ready: failures.length === 0,
    xcode,
    assets,
    failures,
  }
}

function renderReadinessSummary(readiness: ReturnType<typeof assessMacSigningReadiness>): string {
  const lines = [
    readiness.ready
      ? "Signed macOS packaging is ready."
      : "Signed macOS packaging is not ready yet.",
    "",
    readiness.xcode.ok
      ? `Xcode: OK (${readiness.xcode.developerDir})`
      : `Xcode: BLOCKED (${readiness.xcode.developerDir ?? "unknown developer dir"})`,
  ]

  if (readiness.xcode.ok) {
    lines.push(readiness.xcode.version)
  } else {
    lines.push(readiness.xcode.error)
  }

  lines.push("", "Signing assets:")
  for (const asset of readiness.assets) {
    lines.push(`- ${asset.ok ? "OK" : "BLOCKED"} ${asset.detail}`)
  }

  if (readiness.failures.length > 0) {
    lines.push("", "Blockers:")
    for (const failure of readiness.failures) {
      lines.push(`- ${failure}`)
    }
  }

  return `${lines.join("\n")}\n`
}

if (import.meta.main) {
  const readiness = assessMacSigningReadiness()
  process.stdout.write(renderReadinessSummary(readiness))
  process.exit(readiness.ready ? 0 : 1)
}
