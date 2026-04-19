import { describe, expect, it } from "vitest"
import { parseArtifacts } from "@/lib/artifacts/parseArtifacts"
import { artifactSentinel } from "@/lib/artifacts/types"

describe("parseArtifacts", () => {
  const MID = "msg-1"

  it("returns empty input untouched", () => {
    const r = parseArtifacts("", MID)
    expect(r.cleanedContent).toBe("")
    expect(r.artifacts).toEqual([])
    expect(r.pendingArtifact).toBeNull()
  })

  it("extracts a well-formed code artifact", () => {
    const src = `Here's the script:\n<artifact id="a1" kind="code" language="python" title="solve.py" filename="solve.py">\ndef solve(n):\n  return n*2\n</artifact>\nEnd.`
    const r = parseArtifacts(src, MID)

    expect(r.artifacts).toHaveLength(1)
    const a = r.artifacts[0]!
    expect(a.id).toBe("a1")
    expect(a.kind).toBe("code")
    expect(a.language).toBe("python")
    expect(a.title).toBe("solve.py")
    expect(a.filename).toBe("solve.py")
    expect(a.content).toBe("def solve(n):\n  return n*2")

    expect(r.cleanedContent).toContain(artifactSentinel("a1"))
    expect(r.cleanedContent).not.toContain("<artifact")
    expect(r.cleanedContent).not.toContain("def solve")
    expect(r.pendingArtifact).toBeNull()
  })

  it("synthesises an id when missing", () => {
    const src = `<artifact kind="markdown">hello</artifact>`
    const r = parseArtifacts(src, MID)
    expect(r.artifacts[0]!.id).toBe(`${MID}:artifact:0`)
    expect(r.artifacts[0]!.title).toBe("Untitled artifact")
  })

  it("handles multiple artifacts in one message", () => {
    const src = `one <artifact kind="code">a</artifact> two <artifact kind="markdown">b</artifact> three`
    const r = parseArtifacts(src, MID)
    expect(r.artifacts).toHaveLength(2)
    expect(r.artifacts[0]!.kind).toBe("code")
    expect(r.artifacts[1]!.kind).toBe("markdown")
  })

  it("leaves malformed tag (no closing) untreated and emits a pending artifact", () => {
    const src = `intro\n<artifact kind="code" title="solve.py">\ndef solve(n):`
    const r = parseArtifacts(src, MID)
    expect(r.artifacts).toHaveLength(0)
    expect(r.pendingArtifact).not.toBeNull()
    expect(r.pendingArtifact!.kind).toBe("code")
    expect(r.pendingArtifact!.title).toBe("solve.py")
    expect(r.pendingArtifact!.bytesSoFar).toBe("\ndef solve(n):".length)
    expect(r.cleanedContent).not.toContain("<artifact")
    expect(r.cleanedContent).not.toContain("def solve")
    expect(r.cleanedContent).toBe("intro\n")
  })

  it("truncates a torn opener like '<arti' with no pending artifact", () => {
    const src = `before <arti`
    const r = parseArtifacts(src, MID)
    expect(r.pendingArtifact).toBeNull()
    expect(r.cleanedContent).toBe("before ")
  })

  it("truncates an incomplete opener '<artifact kind=' with no pending artifact", () => {
    const src = `before <artifact kind="code"`
    const r = parseArtifacts(src, MID)
    expect(r.pendingArtifact).toBeNull()
    expect(r.cleanedContent).toBe("before ")
  })

  it("surfaces both a closed and a pending artifact in one pass", () => {
    const src = `start <artifact id="x" kind="code">done</artifact> middle <artifact kind="markdown">half`
    const r = parseArtifacts(src, MID)
    expect(r.artifacts).toHaveLength(1)
    expect(r.artifacts[0]!.id).toBe("x")
    expect(r.pendingArtifact).not.toBeNull()
    expect(r.pendingArtifact!.kind).toBe("markdown")
    expect(r.cleanedContent).toContain(artifactSentinel("x"))
    expect(r.cleanedContent).not.toContain("<artifact kind=\"markdown\"")
  })

  it("resolves a pending artifact after the closing tag streams in", () => {
    const first = `<artifact kind="code" title="solve.py">def solve(n):`
    const r1 = parseArtifacts(first, MID)
    expect(r1.pendingArtifact).not.toBeNull()
    expect(r1.artifacts).toHaveLength(0)

    const second = `${first} return n*2</artifact>`
    const r2 = parseArtifacts(second, MID)
    expect(r2.pendingArtifact).toBeNull()
    expect(r2.artifacts).toHaveLength(1)
    expect(r2.artifacts[0]!.content).toBe("def solve(n): return n*2")
  })

  it("leaves a plain `<` (not an artifact opener) alone", () => {
    const src = `a < b and c > d`
    const r = parseArtifacts(src, MID)
    expect(r.cleanedContent).toBe(src)
    expect(r.pendingArtifact).toBeNull()
  })
})
