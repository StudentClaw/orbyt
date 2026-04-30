import { describe, test, expect } from "bun:test"
import { parseHeartbeatProtocol } from "../heartbeat-protocol.js"

describe("parseHeartbeatProtocol", () => {
  test("SKIP yields a skip decision", () => {
    const out = parseHeartbeatProtocol("SKIP")
    expect(out.decision).toBe("skip")
  })

  test("empty or whitespace-only input is treated as skip", () => {
    expect(parseHeartbeatProtocol("").decision).toBe("skip")
    expect(parseHeartbeatProtocol("   \n\t  ").decision).toBe("skip")
  })

  test("narration without a DIGEST marker is treated as skip", () => {
    expect(parseHeartbeatProtocol("just some narration").decision).toBe("skip")
    expect(parseHeartbeatProtocol("HEARTBEAT_OK").decision).toBe("skip")
  })

  test("DIGEST line yields a digest decision with the body", () => {
    const out = parseHeartbeatProtocol(
      "DIGEST: yo cs38 lab 4 due in 25 min, pull it up",
    )
    expect(out.decision).toBe("digest")
    if (out.decision === "digest") {
      expect(out.body).toBe("yo cs38 lab 4 due in 25 min, pull it up")
    }
  })

  test("empty digest body becomes skip", () => {
    expect(parseHeartbeatProtocol("DIGEST:   ").decision).toBe("skip")
    expect(parseHeartbeatProtocol("DIGEST: ").decision).toBe("skip")
  })

  test("emoji are stripped from the digest body", () => {
    const out = parseHeartbeatProtocol(
      "DIGEST: 🚀 you have a chem exam in 2 hrs",
    )
    expect(out.decision).toBe("digest")
    if (out.decision === "digest") {
      expect(out.body).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
      expect(out.body).toContain("chem exam")
    }
  })

  test("unicode dashes are stripped", () => {
    const out = parseHeartbeatProtocol("DIGEST: yo — chem exam soon")
    expect(out.decision).toBe("digest")
    if (out.decision === "digest") {
      expect(out.body).not.toMatch(/[‐-―−]/)
    }
  })

  test("ascii hyphen used as a separator is collapsed to a space", () => {
    const out = parseHeartbeatProtocol("DIGEST: yo - chem exam soon")
    expect(out.decision).toBe("digest")
    if (out.decision === "digest") {
      expect(out.body).not.toContain(" - ")
    }
  })

  test("DIGEST with multi-line body keeps the body content", () => {
    const out = parseHeartbeatProtocol(
      "DIGEST: line one\nline two",
    )
    expect(out.decision).toBe("digest")
    if (out.decision === "digest") {
      expect(out.body).toContain("line one")
      expect(out.body).toContain("line two")
    }
  })
})
