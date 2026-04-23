import { describe, test, expect } from "vitest"
import {
  buildPromptContent,
  extractDisplayContent,
  fileUrlFromPath,
} from "../lib/chatAttachments"
import type { TurnAttachmentInput } from "@orbyt/contracts"

const makeAttachment = (path: string): TurnAttachmentInput => ({
  path,
  name: path.split("/").at(-1) ?? path,
  mimeType: null,
  sizeBytes: null,
  kind: "file",
})

// ============================================================================
// buildPromptContent
// ============================================================================

describe("buildPromptContent", () => {
  test("returns trimmed content when no attachments", () => {
    expect(buildPromptContent("  hello world  ", [])).toBe("hello world")
  })

  test("returns empty string when content is blank and no attachments", () => {
    expect(buildPromptContent("   ", [])).toBe("")
  })

  test("lists attachment paths with header when content is empty", () => {
    const attachments = [makeAttachment("/home/user/file.txt")]
    const result = buildPromptContent("", attachments)
    expect(result).toBe("Attached files:\n- /home/user/file.txt")
  })

  test("includes user message section when content is non-empty", () => {
    const attachments = [makeAttachment("/tmp/notes.pdf")]
    const result = buildPromptContent("summarise this", attachments)
    expect(result).toBe(
      "Attached files:\n- /tmp/notes.pdf\n\nUser message:\nsummarise this",
    )
  })

  test("lists multiple attachments in order", () => {
    const attachments = [
      makeAttachment("/a.txt"),
      makeAttachment("/b.txt"),
      makeAttachment("/c.txt"),
    ]
    const result = buildPromptContent("", attachments)
    expect(result).toContain("- /a.txt\n- /b.txt\n- /c.txt")
  })

  test("trims whitespace from content before embedding", () => {
    const attachments = [makeAttachment("/x.png")]
    const result = buildPromptContent("  what is this?  ", attachments)
    expect(result).toContain("what is this?")
    expect(result).not.toContain("  what is this?  ")
  })
})

// ============================================================================
// extractDisplayContent
// ============================================================================

describe("extractDisplayContent", () => {
  test("returns input unchanged when no attachments", () => {
    expect(extractDisplayContent("hello", [])).toBe("hello")
  })

  test("strips header and returns user message", () => {
    const attachments = [makeAttachment("/tmp/notes.pdf")]
    const encoded = buildPromptContent("summarise this", attachments)
    expect(extractDisplayContent(encoded, attachments)).toBe("summarise this")
  })

  test("returns empty string when there was no user message", () => {
    const attachments = [makeAttachment("/tmp/notes.pdf")]
    const encoded = buildPromptContent("", attachments)
    expect(extractDisplayContent(encoded, attachments)).toBe("")
  })

  test("returns input unchanged when header does not match", () => {
    const attachments = [makeAttachment("/tmp/notes.pdf")]
    const unrelated = "Some unrelated text"
    expect(extractDisplayContent(unrelated, attachments)).toBe(unrelated)
  })

  test("round-trips correctly with multiple attachments", () => {
    const attachments = [makeAttachment("/a.txt"), makeAttachment("/b.txt")]
    const encoded = buildPromptContent("explain both files", attachments)
    expect(extractDisplayContent(encoded, attachments)).toBe("explain both files")
  })

  test("normalises CRLF line endings when matching", () => {
    const attachments = [makeAttachment("/file.txt")]
    const encoded = buildPromptContent("question", attachments)
    // Replace LF with CRLF as if it came from a Windows clipboard paste
    const crlfEncoded = encoded.replace(/\n/g, "\r\n")
    expect(extractDisplayContent(crlfEncoded, attachments)).toBe("question")
  })
})

// ============================================================================
// fileUrlFromPath
// ============================================================================

describe("fileUrlFromPath", () => {
  test("converts an absolute POSIX path to a file URL", () => {
    expect(fileUrlFromPath("/home/user/photo.jpg")).toBe(
      "file:///home/user/photo.jpg",
    )
  })

  test("converts a path without leading slash by prepending one", () => {
    const result = fileUrlFromPath("relative/path.txt")
    expect(result).toMatch(/^file:\/\/\//)
  })

  test("normalises Windows-style backslashes", () => {
    const result = fileUrlFromPath("C:\\Users\\user\\file.jpg")
    expect(result).toContain("C:/Users/user/file.jpg")
  })

  test("returns a string starting with file://", () => {
    expect(fileUrlFromPath("/any/path")).toMatch(/^file:\/\//)
  })
})
