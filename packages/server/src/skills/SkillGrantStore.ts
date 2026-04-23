import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { SkillId } from "@orbyt/contracts"

export interface SkillGrantStore {
  readonly get: (skillId: SkillId) => readonly string[]
  readonly grant: (skillId: SkillId, keys: readonly string[]) => readonly string[]
  readonly revoke: (skillId: SkillId, keys: readonly string[]) => readonly string[]
  readonly snapshot: () => Readonly<Record<string, readonly string[]>>
}

type FileShape = {
  readonly version: 1
  readonly skills: Record<string, { readonly grantedKeys: string[] }>
}

const STORE_VERSION = 1

function loadFromDisk(storePath: string): Map<string, Set<string>> {
  const state = new Map<string, Set<string>>()
  if (!existsSync(storePath)) {
    return state
  }
  try {
    const raw = JSON.parse(readFileSync(storePath, "utf8")) as Partial<FileShape>
    if (!raw || typeof raw !== "object" || !raw.skills || typeof raw.skills !== "object") {
      return state
    }
    for (const [slug, entry] of Object.entries(raw.skills)) {
      if (!entry || !Array.isArray(entry.grantedKeys)) continue
      const keys = entry.grantedKeys.filter((k): k is string => typeof k === "string" && k.length > 0)
      if (keys.length > 0) state.set(slug, new Set(keys))
    }
  } catch {
    return new Map<string, Set<string>>()
  }
  return state
}

function writeToDisk(storePath: string, state: Map<string, Set<string>>): void {
  const skills: Record<string, { grantedKeys: string[] }> = {}
  for (const [slug, keys] of state) {
    skills[slug] = { grantedKeys: [...keys].sort() }
  }
  const payload: FileShape = { version: STORE_VERSION, skills }
  mkdirSync(path.dirname(storePath), { recursive: true })
  writeFileSync(storePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
}

export function createFileSkillGrantStore(storePath: string): SkillGrantStore {
  const state = loadFromDisk(storePath)

  const ensure = (slug: string): Set<string> => {
    const existing = state.get(slug)
    if (existing) return existing
    const fresh = new Set<string>()
    state.set(slug, fresh)
    return fresh
  }

  return {
    get(skillId) {
      return [...(state.get(skillId) ?? new Set<string>())]
    },
    grant(skillId, keys) {
      const set = ensure(skillId)
      for (const key of keys) set.add(key)
      writeToDisk(storePath, state)
      return [...set]
    },
    revoke(skillId, keys) {
      const set = state.get(skillId)
      if (!set) return []
      for (const key of keys) set.delete(key)
      if (set.size === 0) state.delete(skillId)
      writeToDisk(storePath, state)
      return [...(state.get(skillId) ?? new Set<string>())]
    },
    snapshot() {
      const out: Record<string, readonly string[]> = {}
      for (const [slug, keys] of state) out[slug] = [...keys]
      return out
    },
  }
}
