import { describe, test, expect } from "vitest"
import {
  buildPromptContent,
  extractDisplayContent,
  fileUrlFromPath,
} from "../lib/chatAttachments"
import type {
  TurnAttachmentInput,
  TurnReferenceInput,
} from "@orbyt/contracts"

const makeAttachment = (path: string): TurnAttachmentInput => ({
  path,
  name: path.split("/").at(-1) ?? path,
  mimeType: null,
  sizeBytes: null,
  kind: "file",
})

const makeReference = (
  id: string,
  label: string,
  url: string | null = `https://canvas.example.edu/${id}`,
  kind: TurnReferenceInput["kind"] = "canvas-assignment",
): TurnReferenceInput => ({
  kind,
  id,
  label,
  url,
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

  test("emits a Referenced Canvas items block when references are present", () => {
    const refs = [makeReference("assignment:12345", "Essay 3")]
    const result = buildPromptContent("review this", [], refs)
    expect(result.startsWith("Referenced Canvas items:")).toBe(true)
    expect(result).toContain("assignment:12345")
    expect(result).toContain("https://canvas.example.edu/assignment:12345")
    expect(result).toContain("review this")
  })

  test("emits references block before attachments block when both are present", () => {
    const attachments = [makeAttachment("/notes.pdf")]
    const refs = [makeReference("assignment:12345", "Essay 3")]
    const result = buildPromptContent("please review", attachments, refs)
    const refIdx = result.indexOf("Referenced Canvas items:")
    const attIdx = result.indexOf("Attached files:")
    expect(refIdx).toBeGreaterThanOrEqual(0)
    expect(attIdx).toBeGreaterThan(refIdx)
  })

  test("produces byte-identical output to attachments-only path when references is empty", () => {
    const attachments = [makeAttachment("/n.pdf")]
    expect(buildPromptContent("hi", attachments, [])).toBe(
      buildPromptContent("hi", attachments),
    )
  })

  test("returns empty string for empty body and no refs or attachments", () => {
    expect(buildPromptContent("", [], [])).toBe("")
  })

  test("renders a clean reference line when url is null (no literal null in output)", () => {
    const refs = [makeReference("assignment:7", "Quiz 1", null)]
    const result = buildPromptContent("hi", [], refs)
    expect(result).toContain("assignment_id=assignment:7")
    expect(result).not.toMatch(/url=null/)
  })

  test("labels coursework references distinctly from assignment references", () => {
    const refs = [
      makeReference(
        "canvas-coursework:page:2:module-16-readings",
        "Read: Folktale and Myth",
        "https://canvas.example.edu/courses/2/pages/module-16-readings",
        "canvas-coursework",
      ),
    ]
    const result = buildPromptContent("summarize this", [], refs)
    expect(result).toContain("Referenced Canvas items:")
    expect(result).toContain("coursework_id=canvas-coursework:page:2:module-16-readings")
    expect(result).not.toContain("assignment_id=canvas-coursework")
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

  test("strips references block and returns user message", () => {
    const refs = [makeReference("assignment:12345", "Essay 3")]
    const encoded = buildPromptContent("review this", [], refs)
    expect(extractDisplayContent(encoded, [], refs)).toBe("review this")
  })

  test("strips both references and attachments blocks in either order", () => {
    const attachments = [makeAttachment("/notes.pdf")]
    const refs = [makeReference("assignment:12345", "Essay 3")]
    const encoded = buildPromptContent("please review", attachments, refs)
    expect(extractDisplayContent(encoded, attachments, refs)).toBe(
      "please review",
    )
  })

  test("returns input unchanged when no headers present", () => {
    const refs = [makeReference("assignment:1", "X")]
    expect(extractDisplayContent("just a message", [], refs)).toBe(
      "just a message",
    )
  })

  test("returns empty string when only references were present and body was empty", () => {
    const refs = [makeReference("assignment:1", "X")]
    const encoded = buildPromptContent("", [], refs)
    expect(extractDisplayContent(encoded, [], refs)).toBe("")
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
