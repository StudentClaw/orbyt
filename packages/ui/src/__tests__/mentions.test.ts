import { describe, expect, test } from "vitest"
import {
  parseMarkdownToMentions,
  serializeMentionToMarkdown,
  type MentionToken,
} from "../lib/mentions"

describe("serializeMentionToMarkdown", () => {
  test("serializes a canvas-assignment mention to a markdown link using the canvas URL", () => {
    const md = serializeMentionToMarkdown({
      kind: "canvas-assignment",
      id: "canvas-course:42:assignment:12345",
      label: "Essay 3",
      url: "https://canvas.example.edu/courses/42/assignments/12345",
    })
    expect(md).toBe(
      "[Essay 3](https://canvas.example.edu/courses/42/assignments/12345)",
    )
  })

  test("serializes a file mention to a markdown link with a file:// URL", () => {
    const md = serializeMentionToMarkdown({
      kind: "file",
      label: "draft.md",
      path: "/abs/draft.md",
    })
    expect(md).toBe("[draft.md](file:///abs/draft.md)")
  })
})

describe("parseMarkdownToMentions", () => {
  test("parses a canvas-assignment markdown link", () => {
    const mentions = parseMarkdownToMentions(
      "please review [Essay 3](https://canvas.example.edu/courses/42/assignments/12345) tonight",
    )
    expect(mentions).toHaveLength(1)
    const first = mentions[0] as MentionToken
    expect(first.mention.kind).toBe("canvas-assignment")
    if (first.mention.kind === "canvas-assignment") {
      expect(first.mention.label).toBe("Essay 3")
      expect(first.mention.id).toBe("canvas-course:42:assignment:12345")
      expect(first.mention.url).toBe(
        "https://canvas.example.edu/courses/42/assignments/12345",
      )
    }
    expect(first.startOffset).toBeGreaterThanOrEqual(0)
    expect(first.endOffset).toBeGreaterThan(first.startOffset)
  })

  test("parses a file mention and preserves the absolute path", () => {
    const mentions = parseMarkdownToMentions("open [draft.md](file:///abs/draft.md)")
    expect(mentions).toHaveLength(1)
    const first = mentions[0] as MentionToken
    expect(first.mention.kind).toBe("file")
    if (first.mention.kind === "file") {
      expect(first.mention.label).toBe("draft.md")
      expect(first.mention.path).toBe("/abs/draft.md")
    }
  })

  test("ignores unrelated markdown links", () => {
    const mentions = parseMarkdownToMentions(
      "see [my docs](https://example.com/readme) for details",
    )
    expect(mentions).toEqual([])
  })

  test("round-trips: serialize then parse yields the same mention", () => {
    const original = {
      kind: "canvas-assignment" as const,
      id: "canvas-course:42:assignment:12345",
      label: "Essay 3",
      url: "https://canvas.example.edu/courses/42/assignments/12345",
    }
    const md = serializeMentionToMarkdown(original)
    const mentions = parseMarkdownToMentions(md)
    expect(mentions).toHaveLength(1)
    const first = mentions[0] as MentionToken
    expect(first.mention).toEqual(original)
  })

  test("parses multiple mentions in order", () => {
    const md =
      "look at [Essay 3](https://canvas.example.edu/courses/42/assignments/12345) and [draft.md](file:///abs/draft.md)"
    const mentions = parseMarkdownToMentions(md)
    expect(mentions).toHaveLength(2)
    const [first, second] = mentions as [MentionToken, MentionToken]
    expect(first.mention.kind).toBe("canvas-assignment")
    expect(second.mention.kind).toBe("file")
  })
})
