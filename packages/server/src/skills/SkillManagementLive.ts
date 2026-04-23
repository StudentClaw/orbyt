import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Effect, Layer } from "effect"
import { ConfigService } from "../config/ConfigService.js"
import { SkillManagement } from "./SkillManagement.js"
import { createSkillManagementService } from "./SkillManagementService.js"
import { createFileSkillGrantStore } from "./SkillGrantStore.js"

function resolveCuratedRoots(): string[] {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  const ordered: string[] = []
  const seen = new Set<string>()

  const addRoot = (candidate: string | undefined) => {
    if (!candidate) return
    if (seen.has(candidate)) return
    if (existsSync(candidate)) {
      ordered.push(candidate)
      seen.add(candidate)
    }
  }

  addRoot(process.env.ORBYT_BUNDLED_SKILLS_DIR)

  for (const startDir of [moduleDir, process.cwd()]) {
    let currentDir = startDir
    for (let depth = 0; depth < 8; depth += 1) {
      addRoot(path.join(currentDir, "skills"))
      const parentDir = path.dirname(currentDir)
      if (parentDir === currentDir) break
      currentDir = parentDir
    }
  }

  return ordered
}

function resolveCodexHome(configHome: string | undefined): string {
  return (
    configHome ??
    process.env.CODEX_PROCESS_HOME_PATH ??
    process.env.CODEX_HOME_PATH ??
    path.join(process.env.HOME ?? process.cwd(), ".orbyt", "codex-user-home")
  )
}

export const SkillManagementLive = Layer.effect(
  SkillManagement,
  Effect.gen(function* () {
    const config = yield* ConfigService
    const codexHome = resolveCodexHome(config.codexProcessHomePath)
    const userSkillsDir = path.join(codexHome, ".agents", "skills")
    const grantStorePath = path.join(codexHome, ".agents", "skills.grants.json")

    mkdirSync(userSkillsDir, { recursive: true })
    mkdirSync(path.dirname(grantStorePath), { recursive: true })

    const grantStore = createFileSkillGrantStore(grantStorePath)
    const curatedRoots = resolveCuratedRoots()

    return createSkillManagementService({
      userSkillsDir,
      curatedRoots,
      grantStore,
    })
  }),
)
