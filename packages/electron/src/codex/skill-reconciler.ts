import { createHash } from "node:crypto"
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

export type BundledSkillManifestEntry = {
  readonly slug: string
  readonly version: string
  readonly contentHash: string
}

export type BundledSkillManifest = {
  readonly version: number
  readonly generatedAt: string
  readonly skills: readonly BundledSkillManifestEntry[]
}

export type ReconcilerSkillState = {
  readonly bundledVersion: string
  readonly contentHash: string
}

export type ReconcilerState = {
  readonly version: number
  readonly installed: Record<string, ReconcilerSkillState>
}

export type ReconcileBundledSkillsOptions = {
  readonly bundleRoot: string
  readonly userSkillsDir: string
  readonly statePath: string
}

export type ReconcileReason = "first-install" | "upgrade" | "fork-detected" | "missing-source"

export type ReconcileEntryResult = {
  readonly slug: string
  readonly reason: ReconcileReason
  readonly bundledVersion: string
  readonly bundledHash: string
}

export type ReconcileBundledSkillsResult = {
  readonly installed: readonly ReconcileEntryResult[]
  readonly skipped: readonly ReconcileEntryResult[]
}

const STATE_VERSION = 1
const MANIFEST_FILENAME = "bundled-skills.manifest.json"
const SKILL_FILENAME = "SKILL.md"

function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex")
}

function readManifest(bundleRoot: string): BundledSkillManifest | null {
  const manifestPath = path.join(bundleRoot, MANIFEST_FILENAME)
  if (!existsSync(manifestPath)) {
    return null
  }
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as BundledSkillManifest
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.skills)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function readStateSafe(statePath: string): ReconcilerState {
  if (!existsSync(statePath)) {
    return { version: STATE_VERSION, installed: {} }
  }
  try {
    const parsed = JSON.parse(readFileSync(statePath, "utf8")) as ReconcilerState
    if (!parsed || typeof parsed !== "object" || typeof parsed.installed !== "object") {
      return { version: STATE_VERSION, installed: {} }
    }
    return parsed
  } catch {
    return { version: STATE_VERSION, installed: {} }
  }
}

function writeState(statePath: string, state: ReconcilerState): void {
  mkdirSync(path.dirname(statePath), { recursive: true })
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
}

function copyBundledSkill(bundleRoot: string, slug: string, userSkillsDir: string): void {
  const source = path.join(bundleRoot, slug)
  const target = path.join(userSkillsDir, slug)
  mkdirSync(path.dirname(target), { recursive: true })
  cpSync(source, target, { recursive: true, force: true })
}

export function reconcileBundledSkills(
  options: ReconcileBundledSkillsOptions,
): ReconcileBundledSkillsResult {
  const manifest = readManifest(options.bundleRoot)
  if (!manifest) {
    return { installed: [], skipped: [] }
  }

  mkdirSync(options.userSkillsDir, { recursive: true })
  const priorState = readStateSafe(options.statePath)
  const nextInstalled: Record<string, ReconcilerSkillState> = { ...priorState.installed }

  const installed: ReconcileEntryResult[] = []
  const skipped: ReconcileEntryResult[] = []

  for (const bundled of manifest.skills) {
    const bundledSkillFile = path.join(options.bundleRoot, bundled.slug, SKILL_FILENAME)
    if (!existsSync(bundledSkillFile)) {
      skipped.push({
        slug: bundled.slug,
        reason: "missing-source",
        bundledVersion: bundled.version,
        bundledHash: bundled.contentHash,
      })
      continue
    }

    const userSkillFile = path.join(options.userSkillsDir, bundled.slug, SKILL_FILENAME)
    const prev = priorState.installed[bundled.slug]

    if (!existsSync(userSkillFile)) {
      copyBundledSkill(options.bundleRoot, bundled.slug, options.userSkillsDir)
      installed.push({
        slug: bundled.slug,
        reason: "first-install",
        bundledVersion: bundled.version,
        bundledHash: bundled.contentHash,
      })
      nextInstalled[bundled.slug] = {
        bundledVersion: bundled.version,
        contentHash: bundled.contentHash,
      }
      continue
    }

    const currentHash = sha256(readFileSync(userSkillFile))
    if (prev && currentHash === prev.contentHash) {
      copyBundledSkill(options.bundleRoot, bundled.slug, options.userSkillsDir)
      installed.push({
        slug: bundled.slug,
        reason: "upgrade",
        bundledVersion: bundled.version,
        bundledHash: bundled.contentHash,
      })
      nextInstalled[bundled.slug] = {
        bundledVersion: bundled.version,
        contentHash: bundled.contentHash,
      }
      continue
    }

    skipped.push({
      slug: bundled.slug,
      reason: "fork-detected",
      bundledVersion: bundled.version,
      bundledHash: bundled.contentHash,
    })
  }

  writeState(options.statePath, { version: STATE_VERSION, installed: nextInstalled })

  return { installed, skipped }
}
