import { afterAll, describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"
import {
  createWorkspaceFileSearch,
  fuzzyScore,
} from "../ipc/workspace-file-search.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "orbyt-file-search-"))
  tempDirs.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // best-effort cleanup
    }
  }
})

describe("fuzzyScore", () => {
  test("returns null when characters cannot be matched in order", () => {
    expect(fuzzyScore("zzz", "draft.md")).toBeNull()
  })

  test("scores exact-prefix matches above subsequence matches", () => {
    const exact = fuzzyScore("draft", "draft.md") ?? -Infinity
    const sub = fuzzyScore("draft", "my-draft-notes.md") ?? -Infinity
    expect(exact).toBeGreaterThan(sub)
  })

  test("ranks contiguous subsequence above scattered subsequence", () => {
    const contiguous = fuzzyScore("drft", "drft.md") ?? -Infinity
    const scattered = fuzzyScore("drft", "d_r_a_f_t_extra.md") ?? -Infinity
    expect(contiguous).toBeGreaterThan(scattered)
  })

  test("empty query returns a non-null baseline score", () => {
    expect(fuzzyScore("", "anything.md")).not.toBeNull()
  })
})

describe("createWorkspaceFileSearch handler", () => {
  test("returns [] when workspace root does not exist on disk", async () => {
    const search = createWorkspaceFileSearch()
    const result = await search({
      workspaceRoot: path.join(tmpdir(), "does-not-exist-orbyt-search"),
      query: "anything",
    })
    expect(result).toEqual([])
  })

  test("finds a file by exact name under a temp workspace", async () => {
    const root = createTempDir()
    writeFileSync(path.join(root, "draft.md"), "hello")
    const search = createWorkspaceFileSearch()
    const result = await search({ workspaceRoot: root, query: "draft" })
    expect(result.some((r) => r.path.endsWith("draft.md"))).toBe(true)
  })

  test("skips entries under node_modules and .git", async () => {
    const root = createTempDir()
    mkdirSync(path.join(root, "node_modules", "pkg"), { recursive: true })
    writeFileSync(path.join(root, "node_modules", "pkg", "draft.md"), "x")
    mkdirSync(path.join(root, ".git"), { recursive: true })
    writeFileSync(path.join(root, ".git", "draft.md"), "x")
    writeFileSync(path.join(root, "draft.md"), "real")
    const search = createWorkspaceFileSearch()
    const result = await search({ workspaceRoot: root, query: "draft" })
    const paths = result.map((r) => r.path)
    expect(paths.filter((p) => p.includes("node_modules"))).toHaveLength(0)
    expect(paths.filter((p) => p.includes(".git"))).toHaveLength(0)
    expect(paths.some((p) => p.endsWith(`${root}/draft.md`))).toBe(true)
  })

  test("does not descend past the default depth cap of 8", async () => {
    const root = createTempDir()
    let nested = root
    for (let i = 0; i < 10; i += 1) {
      nested = path.join(nested, `d${i}`)
      mkdirSync(nested, { recursive: true })
    }
    writeFileSync(path.join(nested, "deep.md"), "x")
    const shallow = path.join(root, "shallow.md")
    writeFileSync(shallow, "x")
    const search = createWorkspaceFileSearch()
    const result = await search({ workspaceRoot: root, query: "deep" })
    expect(result.some((r) => r.path.endsWith("deep.md"))).toBe(false)
    const resultShallow = await search({
      workspaceRoot: root,
      query: "shallow",
    })
    expect(resultShallow.some((r) => r.path.endsWith("shallow.md"))).toBe(true)
  })

  test("ranks draft.md above rubric.md for query 'drft'", async () => {
    const root = createTempDir()
    writeFileSync(path.join(root, "draft.md"), "x")
    writeFileSync(path.join(root, "rubric.md"), "x")
    const search = createWorkspaceFileSearch()
    const result = await search({ workspaceRoot: root, query: "drft" })
    const draftIdx = result.findIndex((r) => r.path.endsWith("draft.md"))
    const rubricIdx = result.findIndex((r) => r.path.endsWith("rubric.md"))
    expect(draftIdx).toBeGreaterThanOrEqual(0)
    // rubric.md should either rank after draft or not match at all
    if (rubricIdx >= 0) {
      expect(draftIdx).toBeLessThan(rubricIdx)
    }
  })

  test("honors the limit parameter", async () => {
    const root = createTempDir()
    for (let i = 0; i < 20; i += 1) {
      writeFileSync(path.join(root, `draft-${i}.md`), "x")
    }
    const search = createWorkspaceFileSearch()
    const result = await search({
      workspaceRoot: root,
      query: "draft",
      limit: 5,
    })
    expect(result.length).toBeLessThanOrEqual(5)
  })

  test("recents boost: recorded file ranks above otherwise-equal sibling", async () => {
    const root = createTempDir()
    writeFileSync(path.join(root, "alpha.md"), "x")
    writeFileSync(path.join(root, "beta.md"), "x")
    const search = createWorkspaceFileSearch()
    search.recordRecent(path.join(root, "beta.md"))
    const result = await search({ workspaceRoot: root, query: "" })
    const alphaIdx = result.findIndex((r) => r.path.endsWith("alpha.md"))
    const betaIdx = result.findIndex((r) => r.path.endsWith("beta.md"))
    expect(betaIdx).toBeGreaterThanOrEqual(0)
    expect(alphaIdx).toBeGreaterThanOrEqual(0)
    expect(betaIdx).toBeLessThan(alphaIdx)
  })

  test("recents boost is bounded (ring buffer caps stored entries)", async () => {
    const search = createWorkspaceFileSearch({ recentsCapacity: 3 })
    for (let i = 0; i < 10; i += 1) {
      search.recordRecent(`/tmp/file-${i}.md`)
    }
    expect(search.peekRecents().length).toBeLessThanOrEqual(3)
  })

  test("skips denylisted binary extensions", async () => {
    const root = createTempDir()
    writeFileSync(path.join(root, "clip.mp4"), "x")
    writeFileSync(path.join(root, "clip.zip"), "x")
    writeFileSync(path.join(root, "clip.md"), "x")
    const search = createWorkspaceFileSearch()
    const result = await search({ workspaceRoot: root, query: "clip" })
    const paths = result.map((r) => r.path)
    expect(paths.some((p) => p.endsWith("clip.mp4"))).toBe(false)
    expect(paths.some((p) => p.endsWith("clip.zip"))).toBe(false)
    expect(paths.some((p) => p.endsWith("clip.md"))).toBe(true)
  })
})
