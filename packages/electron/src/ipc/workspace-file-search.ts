import { promises as fs, statSync } from "node:fs"
import path from "node:path"
import type {
  TurnAttachmentInput,
  WorkspaceFileSearchParams,
} from "@orbyt/contracts"

const DEFAULT_LIMIT = 25
const DEFAULT_MAX_DEPTH = 8
const DEFAULT_RECENTS_CAPACITY = 50

const DENYLIST_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  ".cache",
  "dist",
  "build",
  "out",
  ".DS_Store",
])

const DENYLIST_EXTENSIONS = new Set([
  ".zip",
  ".tar",
  ".gz",
  ".tgz",
  ".7z",
  ".rar",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".mp3",
  ".wav",
  ".flac",
  ".ogg",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".iso",
  ".dmg",
  ".pkg",
  ".class",
  ".jar",
])

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  ".bmp": "image/bmp",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xml": "application/xml",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
}

function guessMimeType(filePath: string): string | null {
  return MIME_TYPES_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? null
}

export function fuzzyScore(query: string, candidate: string): number | null {
  const q = query.toLowerCase()
  const c = candidate.toLowerCase()
  if (q.length === 0) {
    return 0
  }

  // exact prefix is strongest
  if (c.startsWith(q)) {
    return 1000 - (c.length - q.length)
  }

  // contiguous substring next
  const subIdx = c.indexOf(q)
  if (subIdx >= 0) {
    return 500 - subIdx - (c.length - q.length)
  }

  // subsequence fallback
  let ci = 0
  let runBonus = 0
  let lastMatchedAt = -2
  let firstMatchedAt = -1
  for (let qi = 0; qi < q.length; qi += 1) {
    const ch = q.charAt(qi)
    let found = -1
    for (let k = ci; k < c.length; k += 1) {
      if (c.charAt(k) === ch) {
        found = k
        break
      }
    }
    if (found === -1) {
      return null
    }
    if (found === lastMatchedAt + 1) {
      runBonus += 2
    }
    if (firstMatchedAt === -1) {
      firstMatchedAt = found
    }
    lastMatchedAt = found
    ci = found + 1
  }
  return 100 + runBonus - firstMatchedAt - (c.length - q.length)
}

type FileEntry = TurnAttachmentInput & { readonly score: number }

async function* walk(
  root: string,
  currentDir: string,
  depth: number,
  maxDepth: number,
): AsyncGenerator<string> {
  if (depth > maxDepth) {
    return
  }
  let entries: import("node:fs").Dirent[] = []
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name)
    if (entry.isDirectory()) {
      if (DENYLIST_DIRECTORIES.has(entry.name)) {
        continue
      }
      yield* walk(root, entryPath, depth + 1, maxDepth)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (DENYLIST_EXTENSIONS.has(ext)) {
        continue
      }
      if (entry.name === ".DS_Store") {
        continue
      }
      yield entryPath
    }
  }
}

function toAttachmentInput(filePath: string): TurnAttachmentInput | null {
  try {
    const stat = statSync(filePath)
    if (!stat.isFile()) {
      return null
    }
    const mimeType = guessMimeType(filePath)
    return {
      path: filePath,
      name: path.basename(filePath),
      mimeType,
      sizeBytes: stat.size,
      kind: mimeType?.startsWith("image/") ? "image" : "file",
    }
  } catch {
    return null
  }
}

export interface WorkspaceFileSearchOptions {
  readonly recentsCapacity?: number
}

export interface WorkspaceFileSearchHandler {
  (params: WorkspaceFileSearchParams): Promise<TurnAttachmentInput[]>
  recordRecent(filePath: string): void
  peekRecents(): readonly string[]
}

export function createWorkspaceFileSearch(
  options: WorkspaceFileSearchOptions = {},
): WorkspaceFileSearchHandler {
  const capacity = options.recentsCapacity ?? DEFAULT_RECENTS_CAPACITY
  const recents: string[] = []

  const recordRecent = (filePath: string) => {
    const existingIdx = recents.indexOf(filePath)
    if (existingIdx >= 0) {
      recents.splice(existingIdx, 1)
    }
    recents.unshift(filePath)
    while (recents.length > capacity) {
      recents.pop()
    }
  }

  const recentsBoostFor = (filePath: string): number => {
    const idx = recents.indexOf(filePath)
    if (idx === -1) {
      return 0
    }
    return Math.max(0, 50 - idx * 2)
  }

  const handler = (async (params: WorkspaceFileSearchParams) => {
    const { workspaceRoot, query } = params
    const limit = params.limit ?? DEFAULT_LIMIT
    const maxDepth = params.maxDepth ?? DEFAULT_MAX_DEPTH

    try {
      const stat = await fs.stat(workspaceRoot)
      if (!stat.isDirectory()) {
        return []
      }
    } catch {
      return []
    }

    const results: FileEntry[] = []
    for await (const filePath of walk(workspaceRoot, workspaceRoot, 0, maxDepth)) {
      const name = path.basename(filePath)
      const score = fuzzyScore(query, name)
      if (score === null) {
        continue
      }
      const entry = toAttachmentInput(filePath)
      if (!entry) {
        continue
      }
      const boost = recentsBoostFor(filePath)
      results.push({ ...entry, score: score + boost })
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit).map(({ score: _score, ...rest }) => rest)
  }) as WorkspaceFileSearchHandler

  handler.recordRecent = recordRecent
  handler.peekRecents = () => [...recents]

  return handler
}
