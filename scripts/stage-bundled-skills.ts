import { createHash } from "node:crypto"
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

export type StageBundledSkillsOptions = {
  skillsRoot: string
  outputRoot: string
  now?: () => Date
}

export type StagedSkillEntry = {
  slug: string
  version: string
  contentHash: string
}

const MANIFEST_FILENAME = "bundled-skills.manifest.json"
const MANIFEST_VERSION = 1
const SKILL_FILENAME = "SKILL.md"

function discoverSkillDirs(skillsRoot: string): string[] {
  if (!existsSync(skillsRoot)) {
    return []
  }

  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(skillsRoot, entry.name))
    .filter((skillDir) => existsSync(path.join(skillDir, SKILL_FILENAME)))
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right)))
}

function hashSkillFile(skillFilePath: string): string {
  return createHash("sha256").update(readFileSync(skillFilePath)).digest("hex")
}

function extractVersionFromFrontmatter(skillFilePath: string): string {
  const raw = readFileSync(skillFilePath, "utf8")
  if (!raw.startsWith("---")) {
    return "0.0.0"
  }

  const end = raw.indexOf("\n---", 3)
  if (end === -1) {
    return "0.0.0"
  }

  const block = raw.slice(3, end)
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^version\s*:\s*(.+?)\s*$/)
    if (match) {
      return match[1].replace(/^["']|["']$/g, "")
    }
  }
  return "0.0.0"
}

export function stageBundledSkills(options: StageBundledSkillsOptions): StagedSkillEntry[] {
  rmSync(options.outputRoot, { recursive: true, force: true })
  mkdirSync(options.outputRoot, { recursive: true })

  const skillDirs = discoverSkillDirs(options.skillsRoot)
  const entries: StagedSkillEntry[] = []

  for (const skillDir of skillDirs) {
    const slug = path.basename(skillDir)
    const stagedSkillDir = path.join(options.outputRoot, slug)
    cpSync(skillDir, stagedSkillDir, { recursive: true })
    const stagedSkillFile = path.join(stagedSkillDir, SKILL_FILENAME)
    entries.push({
      slug,
      version: extractVersionFromFrontmatter(stagedSkillFile),
      contentHash: hashSkillFile(stagedSkillFile),
    })
  }

  const manifest = {
    version: MANIFEST_VERSION,
    generatedAt: (options.now?.() ?? new Date()).toISOString(),
    skills: entries,
  }
  writeFileSync(
    path.join(options.outputRoot, MANIFEST_FILENAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  )

  return entries
}

export function getDefaultStageSkillsOptions(): StageBundledSkillsOptions {
  const repoRoot = path.resolve(import.meta.dir, "..")
  return {
    skillsRoot: path.join(repoRoot, "skills"),
    outputRoot: path.join(repoRoot, "packages", "electron", "dist", "resources", "skills"),
  }
}

if (import.meta.main) {
  const options = getDefaultStageSkillsOptions()
  const staged = stageBundledSkills(options)
  process.stdout.write(`Staged bundled skills: ${staged.map((entry) => entry.slug).join(", ")}\n`)
}
